import { useState } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

export default function Login({ onLoginSuccess, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (onLoginSuccess) {
      onLoginSuccess(email, password)
    }
  }

return (
  <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-dirty-white via-off-white to-dirty-white dark:bg-gradient-to-br dark:from-secondary dark:via-slate-950 dark:to-secondary overflow-y-auto transition-colors duration-300">
    <div className="min-h-full w-full flex items-center justify-center p-4 py-8">
      
      {/* Login Card Container - CENTERED */}
      <div className="w-full max-w-md mx-auto">
        
        {/* School Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-48 h-48 bg-light-cream dark:bg-gray-800 rounded-full mb-6 shadow-xl border-4 border-primary dark:border-white transition-colors duration-300">
            <img 
              src="/cshclogo.png"
              alt="Cebu Sacred Heart College Logo"
              className="w-full h-full object-contain p-2"
            />
          </div>
          
          <h1 className="text-3xl font-bold text-primary dark:text-white mb-2 transition-colors">
            CEBU SACRED HEART COLLEGE
          </h1>
          <p className="text-primary dark:text-white font-semibold text-lg transition-colors">
            School Management System
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border-t-4 border-primary dark:border-white transition-colors duration-300">
          
          {/* Card header row: title + theme toggle */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-2xl font-bold text-secondary dark:text-white transition-colors">
                Welcome Back
              </h2>
              <p className="text-secondary dark:text-gray-400 transition-colors">
                Please sign in to continue
              </p>
            </div>
            <ThemeToggle />
          </div>

          {/* Error Message */}
          { error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-secondary dark:text-gray-300 mb-2 transition-colors">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                placeholder="admin@cshc.edu.ph"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-secondary dark:text-gray-300 mb-2 transition-colors">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 transition-colors">
                  Remember me
                </span>
              </label>
              <a href="#" className="text-sm text-primary hover:text-light-secondary dark:text-white dark:hover:text-light-secondary font-semibold transition-colors">
                Forgot Password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-accent-burgundy hover:from-accent-burgundy hover:to-primary text-white py-3 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Sign In
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 transition-colors">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 transition-colors">
              Need help? Contact IT Support
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6 transition-colors">
          © 2026 Cebu Sacred Heart College. All rights reserved.
        </p>
      </div>
      
    </div>
  </div>
)
}