import { useEffect, useState, useRef } from 'react';
import Toast from './Toast';
import SettingsModal from './SettingsModal';
const SidebarFooter = ({ mini = false, teamId, isMobile = false, DEMO_TEAM_ID }) => {
  const [user, setUser] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const popupRef = useRef(null);
  const [showToast, setShowToast] = useState(false);
  const getAvatarFromCacheOrFetch = async (userId, remoteUrl) => {
    try {
      const key = `avatar:${userId}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const { src, url } = JSON.parse(cached);
        if (src && url === remoteUrl) return src;
      }
      if (!remoteUrl) return null;
      const resp = await fetch(remoteUrl, { mode: 'cors', cache: 'force-cache' });
      const blob = await resp.blob();
      if (blob.size > 0) {
        const dataUrl = await new Promise((resolve) => {
          const fr = new FileReader();
          fr.onloadend = () => resolve(fr.result);
          fr.readAsDataURL(blob);
        });
        localStorage.setItem(key, JSON.stringify({ src: dataUrl, url: remoteUrl, ts: Date.now() }));
        return dataUrl;
      }
    } catch (e) {
      console.warn('Avatar cache fetch failed:', e);
    }
    return remoteUrl ?? null;
  };

  const fetchUserData = async () => {
    let id = localStorage.getItem('demo_user_id');
    if (!id) {
      const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = (Math.random() * 16) | 0; const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16); });
      id = rnd;
      localStorage.setItem('demo_user_id', id);
    }
    const email = localStorage.getItem('demo_user_email') || 'local@community';
    const name = localStorage.getItem('demo_user_name') || (email ? email.split('@')[0] : 'User');
    const avatarHint = localStorage.getItem('demo_user_avatar') || null;
    const avatarUrl = await getAvatarFromCacheOrFetch(id, avatarHint);
    setUser({ id, email, name, avatarUrl, user_metadata: {}, role: 'captain' });
  };
  useEffect(() => { fetchUserData(); }, [teamId]);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setIsPopupOpen(false);
      }
    };
    if (isPopupOpen) window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isPopupOpen]);
  return (
    <div className="relative">
      <div className={mini ? "h-px bg-gray-300 my-2 w-6 mx-auto" : "h-px bg-gray-300 mx-2"} />
      <button
        onClick={() => setIsPopupOpen((prev) => !prev)}
        className={`mt-auto cursor-pointer focus:outline-none ${mini
          ? 'p-1 rounded hover:bg-gray-200'
          : 'block w-full px-2 py-2 flex items-center justify-between'
          }`}
      >
        {mini ? (
          user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt="User"
              className="w-6 h-6 rounded-full object-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/default-avatar.png'; }}
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-semibold">
              {user?.name?.[0] || 'U'}
            </div>
          )
        ) : (
          <div className="w-full px-2 py-2 rounded-md hover:bg-gray-300 transition flex items-center space-x-3">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="User"
                className="w-8 h-8 rounded-full object-cover shrink-0"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/default-avatar.png'; }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-semibold shrink-0">
                {user?.name?.[0] || 'U'}
              </div>
            )}
            <div className="text-left flex-1 min-w-0">
              {(() => {

                const meta = user?.user_metadata || {};
                const label =
                  meta.display_name ||
                  meta.full_name ||
                  meta.name ||
                  user?.name ||
                  (user?.email ? user.email.split('@')[0] : 'User');
                return (
                  <div className="text-sm font-medium text-gray-900 truncate" title={label}>
                    {label}
                  </div>
                );
              })()}
              <div className="text-xs text-gray-500 capitalize">
                {user?.role || 'viewer'}
              </div>
            </div>
          </div>
        )}
      </button>
      {isPopupOpen && (
        <div
          ref={popupRef}
          className={`absolute z-50 shadow-lg border border-gray-300 rounded-[12px] p-2 bg-white ${mini
            ? 'fixed bottom-[60px] left-[10px] w-48'
            : 'bottom-[60px] left-[10px] right-[10px] w-[calc(100%-20px)]'
            }`}
        >
          <div className="p-4 flex items-center space-x-2 w-full overflow-hidden">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path d="M16.585 10C16.585 6.3632 13.6368 3.41504 10 3.41504C6.3632 3.41504 3.41504 6.3632 3.41504 10C3.41504 11.9528 4.26592 13.7062 5.61621 14.9121C6.6544 13.6452 8.23235 12.835 10 12.835C11.7674 12.835 13.3447 13.6454 14.3828 14.9121C15.7334 13.7062 16.585 11.9531 16.585 10ZM10 14.165C8.67626 14.165 7.49115 14.7585 6.69531 15.6953C7.66679 16.2602 8.79525 16.585 10 16.585C11.2041 16.585 12.3316 16.2597 13.3027 15.6953C12.5069 14.759 11.3233 14.1651 10 14.165ZM11.835 8.5C11.835 7.48656 11.0134 6.66504 10 6.66504C8.98656 6.66504 8.16504 7.48656 8.16504 8.5C8.16504 9.51344 8.98656 10.335 10 10.335C11.0134 10.335 11.835 9.51344 11.835 8.5ZM17.915 10C17.915 14.3713 14.3713 17.915 10 17.915C5.62867 17.915 2.08496 14.3713 2.08496 10C2.08496 5.62867 5.62867 2.08496 10 2.08496C14.3713 2.08496 17.915 5.62867 17.915 10ZM13.165 8.5C13.165 10.248 11.748 11.665 10 11.665C8.25202 11.665 6.83496 10.248 6.83496 8.5C6.83496 6.75202 8.25202 5.33496 10 5.33496C11.748 5.33496 13.165 6.75202 13.165 8.5Z" /></svg>
            </div>
            <div
              className="truncate text-left text-sm text-gray-400 hover:text-gray-600 focus:outline-none w-full cursor-pointer"
              title={user?.email}
            >
              {user?.email}
            </div>
          </div>
          <div className="border-t border-gray-200 pb-2" />
          {teamId && (
            <button
              onClick={() => { setIsPopupOpen(false); setIsSettingsOpen(true); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-800 rounded-md hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
                className="shrink-0 text-gray-600 group-hover:text-gray-900 transition-colors">
                <path d="M10.3227 1.62663C11.1514 1.62663 11.9182 2.066 12.3373 2.78092L13.1586 4.18131L13.2123 4.25065C13.2735 4.31105 13.3565 4.34658 13.4448 4.34733L15.06 4.36002L15.2143 4.36686C15.9825 4.4239 16.6774 4.85747 17.0649 5.53092L17.393 6.10221L17.4662 6.23795C17.7814 6.88041 17.7842 7.63306 17.4741 8.27799L17.4028 8.41373L16.6 9.83561C16.5426 9.93768 16.5425 10.0627 16.6 10.1647L17.4028 11.5856L17.4741 11.7223C17.7841 12.3673 17.7815 13.1199 17.4662 13.7624L17.393 13.8981L17.0649 14.4694C16.6774 15.1427 15.9824 15.5764 15.2143 15.6335L15.06 15.6393L13.4448 15.653C13.3565 15.6537 13.2736 15.6892 13.2123 15.7497L13.1586 15.818L12.3373 17.2194C11.9182 17.9342 11.1513 18.3737 10.3227 18.3737H9.6762C8.8995 18.3735 8.17705 17.9874 7.74456 17.3503L7.66253 17.2194L6.84124 15.818C6.79652 15.7418 6.72408 15.6876 6.64105 15.6647L6.55511 15.653L4.93987 15.6393C4.16288 15.633 3.44339 15.2413 3.01605 14.6003L2.93499 14.4694L2.60687 13.8981C2.19555 13.1831 2.1916 12.3039 2.5971 11.5856L3.39886 10.1647L3.43206 10.0846C3.44649 10.0293 3.44644 9.97102 3.43206 9.91569L3.39886 9.83561L2.5971 8.41373C2.19175 7.6955 2.19562 6.8171 2.60687 6.10221L2.93499 5.53092L3.01605 5.40006C3.44337 4.75894 4.1628 4.36636 4.93987 4.36002L6.55511 4.34733L6.64105 4.33561C6.72418 4.31275 6.79651 4.25762 6.84124 4.18131L7.66253 2.78092L7.74456 2.65006C8.17704 2.01277 8.89941 1.62678 9.6762 1.62663H10.3227ZM9.6762 2.9567C9.36439 2.95685 9.07299 3.10138 8.88421 3.34342L8.80999 3.45377L7.9887 4.85416C7.72933 5.29669 7.28288 5.59093 6.78265 5.6608L6.56585 5.67741L4.95062 5.6901C4.63868 5.69265 4.34845 5.84001 4.16155 6.08366L4.08733 6.19401L3.75921 6.7653C3.58227 7.073 3.5808 7.45131 3.7553 7.76041L4.55706 9.18131L4.65179 9.37663C4.81309 9.77605 4.81294 10.2232 4.65179 10.6227L4.55706 10.819L3.7553 12.2399C3.58083 12.549 3.5822 12.9273 3.75921 13.235L4.08733 13.8053L4.16155 13.9157C4.34844 14.1596 4.6385 14.3067 4.95062 14.3092L6.56585 14.3229L6.78265 14.3385C7.28292 14.4084 7.72931 14.7036 7.9887 15.1462L8.80999 16.5465L8.88421 16.6559C9.07298 16.8982 9.36422 17.0435 9.6762 17.0436H10.3227C10.6793 17.0436 11.0095 16.8542 11.1899 16.5465L12.0112 15.1462L12.1332 14.9655C12.4432 14.5668 12.9212 14.3271 13.434 14.3229L15.0492 14.3092L15.1811 14.2995C15.4854 14.2567 15.7569 14.076 15.9125 13.8053L16.2407 13.235L16.2983 13.1169C16.3983 12.8745 16.3999 12.6023 16.3022 12.359L16.2446 12.2399L15.4418 10.819C15.1551 10.311 15.1551 9.6893 15.4418 9.18131L16.2446 7.76041L16.3022 7.64127C16.4 7.39806 16.3982 7.12584 16.2983 6.88346L16.2407 6.7653L15.9125 6.19401C15.7568 5.92338 15.4855 5.74264 15.1811 5.69987L15.0492 5.6901L13.434 5.67741C12.9212 5.67322 12.4432 5.43341 12.1332 5.03483L12.0112 4.85416L11.1899 3.45377C11.0095 3.14604 10.6794 2.9567 10.3227 2.9567H9.6762ZM11.5854 9.99967C11.5852 9.12461 10.8755 8.41497 10.0004 8.41471C9.12516 8.41471 8.41466 9.12445 8.41448 9.99967C8.41448 10.875 9.12505 11.5846 10.0004 11.5846C10.8756 11.5844 11.5854 10.8749 11.5854 9.99967ZM12.9145 9.99967C12.9145 11.6094 11.6101 12.9145 10.0004 12.9147C8.39051 12.9147 7.08538 11.6096 7.08538 9.99967C7.08556 8.38991 8.39062 7.08463 10.0004 7.08463C11.61 7.08489 12.9143 8.39007 12.9145 9.99967Z"></path>
              </svg>
              <span>Settings</span>
            </button>
          )}
          <button
            disabled={true}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-800 rounded-md hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10 transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="shrink-0 text-gray-600 group-hover:text-gray-900 transition-colors"
            >
              <path d="M3.50171 12.6663V7.33333C3.50171 6.64424 3.50106 6.08728 3.53784 5.63704C3.57525 5.17925 3.65463 4.77342 3.84644 4.39681L3.96851 4.17806C4.2726 3.68235 4.70919 3.2785 5.23023 3.01302L5.3728 2.94661C5.7091 2.80238 6.06981 2.73717 6.47046 2.70443C6.9207 2.66764 7.47766 2.66829 8.16675 2.66829H9.16675L9.30054 2.68197C9.60367 2.7439 9.83179 3.0119 9.83179 3.33333C9.83179 3.65476 9.60367 3.92277 9.30054 3.9847L9.16675 3.99837H8.16675C7.45571 3.99837 6.96238 3.99926 6.57886 4.0306C6.297 4.05363 6.10737 4.09049 5.96362 4.14193L5.83374 4.19857C5.53148 4.35259 5.27861 4.58671 5.1023 4.87435L5.03198 5.00032C4.95147 5.15833 4.89472 5.36974 4.86401 5.74544C4.83268 6.12896 4.83179 6.6223 4.83179 7.33333V12.6663C4.83179 13.3772 4.8327 13.8707 4.86401 14.2542C4.8947 14.6298 4.95153 14.8414 5.03198 14.9993L5.1023 15.1263C5.27861 15.4137 5.53163 15.6482 5.83374 15.8021L5.96362 15.8577C6.1074 15.9092 6.29691 15.947 6.57886 15.9701C6.96238 16.0014 7.45571 16.0013 8.16675 16.0013H9.16675L9.30054 16.015C9.6036 16.0769 9.83163 16.345 9.83179 16.6663C9.83179 16.9877 9.60363 17.2558 9.30054 17.3177L9.16675 17.3314H8.16675C7.47766 17.3314 6.9207 17.332 6.47046 17.2952C6.06978 17.2625 5.70912 17.1973 5.3728 17.0531L5.23023 16.9867C4.70911 16.7211 4.27261 16.3174 3.96851 15.8216L3.84644 15.6038C3.65447 15.2271 3.57526 14.8206 3.53784 14.3626C3.50107 13.9124 3.50171 13.3553 3.50171 12.6663ZM13.8035 13.804C13.5438 14.0634 13.1226 14.0635 12.863 13.804C12.6033 13.5443 12.6033 13.1223 12.863 12.8626L13.8035 13.804ZM12.863 6.19661C13.0903 5.96939 13.4409 5.94126 13.699 6.11165L13.8035 6.19661L17.1375 9.52962C17.3969 9.78923 17.3968 10.2104 17.1375 10.4701L13.8035 13.804L13.3337 13.3333L12.863 12.8626L15.0603 10.6654H9.16675C8.79959 10.6654 8.50189 10.3674 8.50171 10.0003C8.50171 9.63306 8.79948 9.33529 9.16675 9.33529H15.0613L12.863 7.13704L12.7781 7.03255C12.6077 6.77449 12.6359 6.42386 12.863 6.19661Z"></path></svg>
            <span>Log out</span>
          </button>
        </div>
      )}
      <Toast
        message="Copied your User ID to clipboard"
        show={showToast}
        onClose={() => setShowToast(false)}
        type="success"
      />
      <SettingsModal
        key={teamId}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        teamId={teamId}
        currentUserId={user?.id}
        canManage={user?.role === 'captain'}
        isMobile={isMobile}
        DEMO_TEAM_ID={DEMO_TEAM_ID}
      />
    </div>
  );
};
export default SidebarFooter;
