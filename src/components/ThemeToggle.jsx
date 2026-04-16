import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-[var(--radius-md)] transition-colors"
      style={{
        backgroundColor: 'var(--color-bg-muted)',
        color: theme === 'light' ? 'var(--color-text-secondary)' : '#fbbf24',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-muted)'}
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5" />
      )}
    </button>
  )
}