import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Onboarding from './features/onboarding/Onboarding'
import HomeFeed from './features/home/HomeFeed'
import Explore from './features/explore/Explore'
import PlaceDetail from './features/explore/PlaceDetail'
import Community from './features/community/Community'
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
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />

      <Route element={<Layout />}>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/explore/:id" element={<PlaceDetail />} />
        <Route path="/community" element={<Community />} />
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
