/**
 * NotFound.jsx — 404 page for any URL that matches no route.
 *
 * Logged in  -> rendered inside DashboardLayout so the sidebar and header stay
 *               available (see NotFoundRoute in App.jsx).
 * Logged out -> rendered as a standalone full-screen page.
 */
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Compass, ArrowLeft, Home, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import StatusPage from '../components/StatusPage'

export default function NotFound({ standalone = false }) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const goBack = () => {
    // history.state.idx > 0 means there is an earlier in-app entry to return to
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(isAuthenticated ? '/dashboard' : '/login', { replace: true })
  }

  return (
    <StatusPage
      fullScreen={standalone}
      icon={Compass}
      code="404"
      title="Page not found"
      message="The page you are looking for does not exist, was moved, or the link is incorrect."
      detail={`${pathname}${search}`}
    >
      <button type="button" onClick={goBack} className="btn btn-ghost gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Go back
      </button>
      <Link to={isAuthenticated ? '/dashboard' : '/login'} className="btn btn-primary gap-1.5">
        {isAuthenticated
          ? <><Home className="w-4 h-4" /> Go to dashboard</>
          : <><LogIn className="w-4 h-4" /> Go to login</>}
      </Link>
    </StatusPage>
  )
}
