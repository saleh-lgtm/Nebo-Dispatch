"use client";

import { MessageSquare, Phone, ChevronRight } from "lucide-react";

interface Conversation {
    conversationPhone: string;
    lastMessage: string;
    lastMessageAt: Date;
    messageCount: number;
    unreadCount: number;
}

interface Props {
    conversations: Conversation[];
    selectedPhone: string | null;
    onSelectConversation: (phone: string) => void;
}

export default function ConversationList({ conversations, selectedPhone, onSelectConversation }: Props) {
    const formatPhone = (phone: string) => {
        if (phone.startsWith("+1") && phone.length === 12) {
            return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
        }
        return phone;
    };

    const formatTime = (date: Date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        } else if (days === 1) {
            return "Yesterday";
        } else if (days < 7) {
            return d.toLocaleDateString(undefined, { weekday: "short" });
        } else {
            return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        }
    };

    if (conversations.length === 0) {
        return (
            <div className="empty-conversations">
                <MessageSquare size={48} />
                <p>No conversations yet</p>
                <span>Send a message to start a conversation</span>
            </div>
        );
    }

    return (
        <div className="conversation-list">
            {conversations.map((conv) => (
                <button
                    key={conv.conversationPhone}
                    className={`conversation-item ${selectedPhone === conv.conversationPhone ? "selected" : ""}`}
                    onClick={() => onSelectConversation(conv.conversationPhone)}
                >
                    <div className="conv-avatar">
                        <Phone size={18} />
                    </div>
                    <div className="conv-content">
                        <div className="conv-header">
                            <span className="conv-phone">{formatPhone(conv.conversationPhone)}</span>
                            <span className="conv-time">{formatTime(conv.lastMessageAt)}</span>
                        </div>
                        <div className="conv-preview">
                            <span className="conv-message">{conv.lastMessage}</span>
                            {conv.unreadCount > 0 && (
                                <span className="conv-unread">{conv.unreadCount}</span>
                            )}
                        </div>
                    </div>
                    <ChevronRight size={16} className="conv-arrow" />
                </button>
            ))}

            <style jsx>{`
                .conversation-list {
                    display: flex;
                    flex-direction: column;
                }

                .empty-conversations {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem 1rem;
                    text-align: center;
                    color: var(--text-muted);
                }

                .empty-conversations :global(svg) {
                    opacity: 0.2;
                    margin-bottom: 1rem;
                }

                .empty-conversations p {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    margin-bottom: 0.25rem;
                }

                .empty-conversations span {
                    font-size: 0.75rem;
                }

                .conversation-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.875rem 1rem;
                    background: none;
                    border: none;
                    border-bottom: 1px solid var(--border);
                    cursor: pointer;
                    text-align: left;
                    width: 100%;
                    transition: background 0.15s;
                }

                .conversation-item:hover {
                    background: var(--bg-hover);
                }

                .conversation-item.selected {
                    background: var(--primary-soft);
                }

                .conv-avatar {
                    width: 44px;
                    height: 44px;
                    background: var(--bg-secondary);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                    flex-shrink: 0;
                }

                .conversation-item.selected .conv-avatar {
                    background: var(--primary);
                    color: white;
                }

                .conv-content {
                    flex: 1;
                    min-width: 0;
                }

                .conv-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.25rem;
                }

                .conv-phone {
                    font-weight: 600;
                    font-size: 0.875rem;
                    color: var(--text-primary);
                }

                .conv-time {
                    font-size: 0.6875rem;
                    color: var(--text-muted);
                }

                .conv-preview {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .conv-message {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    flex: 1;
                }

                .conv-unread {
                    background: var(--primary);
                    color: white;
                    font-size: 0.625rem;
                    font-weight: 700;
                    padding: 0.125rem 0.375rem;
                    border-radius: 9999px;
                    min-width: 18px;
                    text-align: center;
                }

                .conv-arrow {
                    color: var(--text-muted);
                    flex-shrink: 0;
                }
            `}</style>
        </div>
    );
}
