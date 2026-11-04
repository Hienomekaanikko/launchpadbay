import { useTranslation } from 'react-i18next'

const buttonClasses = [
  'app-nav-action',
  'hover:bg-white/8 hover:text-white',
  'aria-expanded:hover:bg-white/10 aria-[current=page]:hover:bg-white/10',
].join(' ')

function NavbarButton({ className = '', ...props }) {
  return <button type="button" className={`${buttonClasses} ${className}`} {...props} />
}

export default function AppNavbar({
  playMode,
  loggedIn,
  username,
  hasUnread,
  lobbyOpen,
  profileOpen,
  editingProfile,
  onHome,
  onLogin,
  onLobby,
  onProfile,
}) {
  const { t } = useTranslation()

  return (
    <header className="app-header border-t border-t-white/18 border-b border-b-white/8 bg-surface/30 backdrop-blur-[15px]">
      <nav className="app-navbar" aria-label={t('nav.mainNavigation')}>
        <div className="app-navbar-brand">
          <NavbarButton
            aria-current={!playMode && !lobbyOpen && !profileOpen && !editingProfile ? 'page' : undefined}
            onClick={onHome}
          >
            {t('nav.home')}
          </NavbarButton>
        </div>

        <div className="app-nav">
          {loggedIn && (
            <>
              <NavbarButton
                aria-label={hasUnread ? t('nav.lobbyUnread') : undefined}
                aria-expanded={lobbyOpen}
                onClick={onLobby}
              >
                <span className="relative">
                  {t('nav.lobby')}
                  {hasUnread && <span className="absolute -top-1 -end-2.5 w-2 h-2 rounded-full bg-brand" aria-hidden="true" />}
                </span>
              </NavbarButton>
              <NavbarButton
                className="app-nav-user"
                id="profile-menu-trigger"
                aria-label={t('nav.profileFor', { username })}
                aria-expanded={profileOpen}
                aria-haspopup="dialog"
                aria-controls={profileOpen ? 'profile-menu' : undefined}
                aria-current={editingProfile ? 'page' : undefined}
                title={username}
                onClick={onProfile}
              >
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand text-[11px] font-bold" aria-hidden="true">
                  {username?.slice(0, 1).toUpperCase() || '?'}
                </span>
                <span className="truncate">{username}</span>
              </NavbarButton>
            </>
          )}
          {!loggedIn && !playMode && (
            <NavbarButton onClick={onLogin}>
              {t('nav.login')}
            </NavbarButton>
          )}
        </div>
      </nav>
    </header>
  )
}
