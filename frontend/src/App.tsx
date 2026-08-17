import { BrowserRouter } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './contexts/AuthContext'
import { AppRoutes } from './routes/AppRoutes'
import { CompanyProvider } from './contexts/CompanyContext'

function App() { return <BrowserRouter><AuthProvider><CompanyProvider><AppRoutes /></CompanyProvider></AuthProvider></BrowserRouter> }
export default App
