import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// Turns the database's own errors into proper HTTP answers. Without this, a
// harmless race (two people liking at the same instant, two signups with the
// same email) shows up as a 500 "Internal server error".
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const response = host.switchToHttp().getResponse<Response>();
    const { status, message } = this.translate(exception);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Prisma.PrismaClientKnownRequestError
          ? `${exception.code}: ${exception.message}`
          : exception.message,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: this.statusName(status),
    });
  }

  private translate(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError) {
    // A value the database layer cannot accept, such as null for a required
    // field. The caller sent something wrong, so this is a 400, not a 500.
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'One of the values is not valid' };
    }

    switch (exception.code) {
      case 'P2002': {
        const target = this.targetOf(exception);

        if (target.includes('email') || target.includes('username')) {
          return { status: HttpStatus.CONFLICT, message: 'Email or username already in use' };
        }

        return { status: HttpStatus.CONFLICT, message: 'This already exists' };
      }
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
      case 'P2003':
        return { status: HttpStatus.BAD_REQUEST, message: 'A related record does not exist' };
      case 'P2000':
        return { status: HttpStatus.BAD_REQUEST, message: 'One of the values is too long' };
      case 'P2034':
        return { status: HttpStatus.CONFLICT, message: 'Please try again' };
      default:
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
    }
  }

  private targetOf(exception: Prisma.PrismaClientKnownRequestError): string {
    const target = exception.meta?.target;

    if (Array.isArray(target)) {
      return target.join(',');
    }

    return typeof target === 'string' ? target : '';
  }

  private statusName(status: number) {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      default:
        return 'Internal Server Error';
    }
  }
}
