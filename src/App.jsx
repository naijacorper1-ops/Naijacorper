import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomeFeed from './features/home/HomeFeed'
import Explore from './features/explore/Explore'
import Community from './features/community/Community'
import Marketplace from './features/marketplace/Marketplace'
import Opportunities from './features/opportunities/Opportunities'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomeFeed />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/community" element={<Community />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}