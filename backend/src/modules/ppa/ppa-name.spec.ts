import { cleanPpaName, makePpaNameKey } from './ppa-name';

describe('makePpaNameKey', () => {
  it('treats different spellings of one organisation as the same', () => {
    const key = makePpaNameKey('Paystack');

    expect(makePpaNameKey('PAYSTACK Ltd.')).toBe(key);
    expect(makePpaNameKey('  paystack  limited ')).toBe(key);
    expect(makePpaNameKey('The Paystack Nig. Ltd')).toBe(key);
    expect(makePpaNameKey('Pay-Stack')).toBe(key);
  });

  it('ignores accents and punctuation', () => {
    expect(makePpaNameKey('Café Étoile')).toBe('cafeetoile');
    expect(makePpaNameKey("St. Mary's Hospital")).toBe('stmaryshospital');
  });

  it('reads & as and', () => {
    expect(makePpaNameKey('Ade & Sons')).toBe(makePpaNameKey('Ade and Sons'));
  });

  it('keeps different organisations apart', () => {
    expect(makePpaNameKey('Zenith Bank')).not.toBe(makePpaNameKey('First Bank'));
    expect(makePpaNameKey('Zenith Bank Nigeria')).not.toBe(makePpaNameKey('Zenith Bank'));
  });

  it('only drops a leading "the" when something else is left', () => {
    expect(makePpaNameKey('The Guardian')).toBe('guardian');
    expect(makePpaNameKey('The')).toBe('the');
  });

  it('keeps a name made only of company words', () => {
    expect(makePpaNameKey('Ltd')).toBe('ltd');
  });

  it('gives an empty key when there is nothing usable', () => {
    expect(makePpaNameKey('???')).toBe('');
  });
});

describe('cleanPpaName', () => {
  it('trims and collapses spaces', () => {
    expect(cleanPpaName('  Zenith   Bank ')).toBe('Zenith Bank');
  });
});
