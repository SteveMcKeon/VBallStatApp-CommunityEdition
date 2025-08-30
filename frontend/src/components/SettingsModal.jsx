import { useState } from 'react';
import Modal from './Modal';
import ManageTeamModal from './ManageTeamModal';
const TeamIcon = () => (
    <svg height="20" width="20" fill="currentColor" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M57,44h-6h-6c-3.3,0-6,2.7-6,6v9c0,1.1,0.5,2.1,1.2,2.8c0.7,0.7,1.7,1.2,2.8,1.2v9c0,3.3,2.7,6,6,6h2h2 c3.3,0,6-2.7,6-6v-9c1.1,0,2.1-0.4,2.8-1.2c0.7-0.7,1.2-1.7,1.2-2.8v-9C63,46.7,60.3,44,57,44z"></path>
        <circle cx="51" cy="33" r="7"></circle>
        <path d="M36.6,66.7c-0.2-0.2-0.5-0.4-0.7-0.6c-1.9-2-3-4.5-3-7.1v-9c0-3.2,1.3-6.2,3.4-8.3c0.6-0.6,0.1-1.7-0.7-1.7c-1.7,0-3.6,0-3.6,0h-6c-3.3,0-6,2.7-6,6v9c0,1.1,0.5,2.1,1.2,2.8c0.7,0.7,1.7,1.2,2.8,1.2v9c0,3.3,2.7,6,6,6h2h2c0.9,0,1.7-0.2,2.4-0.5c0.4-0.2,0.6-0.5,0.6-0.9c0-1.2,0-4,0-5.1C37,67.2,36.9,66.9,36.6,66.7z"></path>
        <circle cx="32" cy="29" r="7"></circle>
        <path d="M76,40h-6c0,0-1.9,0-3.6,0c-0.9,0-1.3,1-0.7,1.7c2.1,2.2,3.4,5.1,3.4,8.3v9c0,2.6-1,5.1-3,7.1c-0.2,0.2-0.4,0.4-0.7,0.6c-0.2,0.2-0.4,0.5-0.4,0.8c0,1.1,0,3.8,0,5.1c0,0.4,0.2,0.8,0.6,0.9c0.7,0.3,1.5,0.5,2.4,0.5h2h2c3.3,0,6-2.7,6-6v-9c1.1,0,2.1-0.4,2.8-1.2c0.7-0.7,1.2-1.7,1.2-2.8v-9C82,42.7,79.3,40,76,40z"></path>
        <circle cx="70" cy="29" r="7"></circle>
    </svg>
);
const TabButton = ({ active, onClick, Icon, children }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left cursor-pointer
      ${active ? 'bg-gray-200 font-semibold' : 'hover:bg-gray-100'}`}
    >
        <span className="text-gray-700"><Icon /></span>
        <span>{children}</span>
    </button>
);
const SettingsModal = ({
    isOpen,
    onClose,
    teamId,
    currentUserId,
    canManage,
    isMobile,
    DEMO_TEAM_ID,
}) => {
    const [tab, setTab] = useState('team');
    if (isMobile) {
        const [teamOpen, setTeamOpen] = useState(false);
        return (
            <>
                <Modal
                    isOpen={isOpen}
                    onClose={onClose}
                    contentClassName="bg-white p-4 rounded-2xl shadow-xl relative p-0 w-[360px] max-w-[95vw] overflow-hidden"
                >
                    <div className="space-y-2">
                        <TabButton active={false} onClick={() => setTeamOpen(true)} Icon={TeamIcon}>
                            Team
                        </TabButton>
                    </div>
                </Modal>
                {/* Sub-modals (embedded = false) */}
                <ManageTeamModal
                    isOpen={teamOpen}
                    onClose={() => setTeamOpen(false)}
                    teamId={teamId}
                    currentUserId={currentUserId}
                    canManage={canManage}
                    embedded={false}
                    DEMO_TEAM_ID={DEMO_TEAM_ID}
                />
            </>
        );
    }
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            closeXLeft
            contentClassName="bg-white rounded-xl shadow-xl relative p-0 w-[680px] max-w-[95vw] overflow-hidden"
        >
            <div className="flex h-[600px] max-h-[600px]">
                {/* Left rail */}
                <aside className="w-[180px] shrink-0 border-r border-gray-200 px-4 pt-12 pb-4">
                    <div className="space-y-1">
                        <TabButton active={tab === 'team'} onClick={() => setTab('team')} Icon={TeamIcon}>Team</TabButton>
                    </div>
                </aside>
                {/* Right content */}
                <section className="w-[500px] py-4 pl-4 pr-2 min-w-0 overflow-y-auto db-list-outer rounded-r-2xl"
                    style={{ scrollbarGutter: 'stable' }}
                >
                    {tab === 'team' && (
                        <ManageTeamModal
                            embedded
                            isOpen
                            teamId={teamId}
                            currentUserId={currentUserId}
                            canManage={canManage}
                            onClose={onClose}
                            DEMO_TEAM_ID={DEMO_TEAM_ID}
                        />
                    )}
                </section>
            </div>
        </Modal>
    );
};
export default SettingsModal;
