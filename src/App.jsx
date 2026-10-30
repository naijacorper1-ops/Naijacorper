import { useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Onboarding from './features/onboarding/Onboarding'
import SignIn from './features/auth/SignIn'
import SignUp from './features/auth/SignUp'
import VerifyEmail from './features/auth/VerifyEmail'
import ForgotPassword from './features/auth/ForgotPassword'
import HomeFeed from './features/home/HomeFeed'
import Explore from './features/explore/Explore'
import PlaceDetail from './features/explore/PlaceDetail'
import Community from './features/community/Community'
import GroupDetail from './features/community/GroupDetail'
import Marketplace from './features/marketplace/Marketplace'
import Opportunities from './features/opportunities/Opportunities'
import Events from './features/events/Events'
import PPA from './features/ppa/PPA'
import StateGuides from './features/guides/StateGuides'
import Profile from './features/profile/Profile'
import PostDetail from './features/post/PostDetail'
import Messages from './features/messages/Messages'
import Notifications from './features/notifications/Notifications'
import Search from './features/search/Search'
import { useApp } from './context/AppContext'
import './App.css'

// Pages behind sign-in. Signed-out visitors go to /signin and come back after.
function RequireAuth({ children }) {
  const { me } = useApp()
  const location = useLocation()
  if (!me) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />
  return children
}

// Sign-in and sign-up are pointless when already signed in. Only checked on
// arrival: once the form signs someone in, the page itself decides where to go
// (e.g. sign-up continues to /verify-email).
function GuestOnly({ children }) {
  const { me } = useApp()
  const [signedInOnArrival] = useState(!!me)
  if (signedInOnArrival) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<GuestOnly><SignIn /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><SignUp /></GuestOnly>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-email" element={<RequireAuth><VerifyEmail /></RequireAuth>} />
      <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/explore/:id" element={<PlaceDetail />} />
        <Route path="/community" element={<Community />} />
        <Route path="/community/:group" element={<GroupDetail />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/events" element={<Events />} />
        <Route path="/ppa" element={<PPA />} />
        <Route path="/guides" element={<StateGuides />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:handle" element={<Profile />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/search" element={<Search />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
