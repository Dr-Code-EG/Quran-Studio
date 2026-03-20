import { Routes, Route } from 'react-router-dom'
import { StudioProvider } from './context/StudioContext'
import Layout from './components/Layout'
import StudioPage from './pages/StudioPage'
import LibraryPage from './pages/LibraryPage'
import JobDetailPage from './pages/JobDetailPage'
import SurahPickerPage from './pages/SurahPickerPage'
import ReciterPickerPage from './pages/ReciterPickerPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <StudioProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<StudioPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/job/:id" element={<JobDetailPage />} />
          <Route path="/surah-picker" element={<SurahPickerPage />} />
          <Route path="/reciter-picker" element={<ReciterPickerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </StudioProvider>
  )
}
