import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
    { to: '/', label: 'Sessions', icon: '📋' },
    { to: '/upload', label: 'Upload', icon: '📤' },
];

const analysisItems = [
    { to: '/overview', label: 'Overview', icon: '📊' },
    { to: '/compare', label: 'Compare', icon: '🔀' },
    { to: '/hotspot', label: 'Hotspot', icon: '🔥' },
    { to: '/trends', label: 'Trends', icon: '📈' },
];

const workItems = [
    { to: '/workboard', label: 'Work Board', icon: '✅' },
];

const Sidebar: React.FC = () => {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">FW</div>
                    <div>
                        <div className="sidebar-logo-text">FW Dashboard</div>
                        <div className="sidebar-logo-sub">Static Code Analysis</div>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section-title">Management</div>
                {navItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <span className="nav-item-icon">{item.icon}</span>
                        {item.label}
                    </NavLink>
                ))}

                <div className="nav-section-title" style={{ marginTop: 12 }}>Analysis</div>
                {analysisItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <span className="nav-item-icon">{item.icon}</span>
                        {item.label}
                    </NavLink>
                ))}

                <div className="nav-section-title" style={{ marginTop: 12 }}>Work</div>
                {workItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <span className="nav-item-icon">{item.icon}</span>
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Reference File
                </div>
                <NavLink
                    to="/reference"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    style={{ marginTop: 4 }}
                >
                    <span className="nav-item-icon">📑</span>
                    Upload Reference
                </NavLink>
            </div>
        </aside>
    );
};

export default Sidebar;
