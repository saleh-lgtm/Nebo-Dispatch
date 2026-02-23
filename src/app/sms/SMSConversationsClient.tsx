"use client";

import { useState, useEffect, useCallback } from "react";
import {
    MessageSquare,
    Phone,
    RefreshCw,
    Loader2,
    MessageCircle,
    Plus,
    Wifi,
    WifiOff,
} from "lucide-react";
import {
    getConversations,
    getConversationMessages,
    sendConversationSMS,
} from "@/lib/twilioActions";
import ConversationList from "@/components/sms/ConversationList";
import ChatView from "@/components/sms/ChatView";
import { useRealtimeSMS } from "@/hooks/useRealtimeSMS";

interface SMSLog {
    id: string;
    direction?: "INBOUND" | "OUTBOUND";
    from?: string | null;
    to: string;
    message: string;
    status: string;
    createdAt: Date;
    sentBy: { id: string; name: string | null } | null;
}

interface Conversation {
    conversationPhone: string;
    lastMessage: string;
    lastMessageAt: Date;
    messageCount: number;
    unreadCount: number;
}

export default function SMSConversationsClient() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [conversationMessages, setConversationMessages] = useState<SMSLog[]>([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSendingChat, setIsSendingChat] = useState(false);
    const [showNewConversation, setShowNewConversation] = useState(false);
    const [newPhoneNumber, setNewPhoneNumber] = useState("");
    const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

    // Real-time SMS updates
    useRealtimeSMS({
        conversationPhone: selectedPhone || undefined,
        enabled: true,
        onNewMessage: useCallback((message: { id: string; direction: "INBOUND" | "OUTBOUND"; from: string | null; to: string; message: string; status: string; createdAt: string; conversationPhone: string | null }) => {
            // Add new message to conversation
            setConversationMessages((prev) => {
                // Avoid duplicates
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, {
                    id: message.id,
                    direction: message.direction,
                    from: message.from,
                    to: message.to,
                    message: message.message,
                    status: message.status,
                    createdAt: new Date(message.createdAt),
                    sentBy: null,
                }];
            });

            // Update conversation list
            setConversations((prev) => {
                const existing = prev.find(
                    (c) => c.conversationPhone === message.conversationPhone
                );
                if (existing) {
                    return prev.map((c) =>
                        c.conversationPhone === message.conversationPhone
                            ? {
                                ...c,
                                lastMessage: message.message,
                                lastMessageAt: new Date(message.createdAt),
                                messageCount: c.messageCount + 1,
                                unreadCount: message.direction === "INBOUND" ? c.unreadCount + 1 : c.unreadCount,
                            }
                            : c
                    ).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
                }
                // New conversation - refresh the list
                loadConversations();
                return prev;
            });

            setIsRealtimeConnected(true);
        }, []),
        onStatusUpdate: useCallback((messageSid: string, newStatus: string) => {
            // Update message status in real-time
            setConversationMessages((prev) =>
                prev.map((m) =>
                    m.id === messageSid || (m as unknown as { messageSid?: string }).messageSid === messageSid
                        ? { ...m, status: newStatus }
                        : m
                )
            );
        }, []),
    });

    const loadConversations = useCallback(async () => {
        setIsLoadingConversations(true);
        try {
            const data = await getConversations({ limit: 50 });
            setConversations(data.conversations as Conversation[]);
        } catch (error) {
            console.error("Failed to load conversations:", error);
        } finally {
            setIsLoadingConversations(false);
        }
    }, []);

    const loadConversationMessages = useCallback(async (phone: string) => {
        setIsLoadingMessages(true);
        try {
            const data = await getConversationMessages(phone, { limit: 100 });
            setConversationMessages(data.messages as unknown as SMSLog[]);
        } catch (error) {
            console.error("Failed to load messages:", error);
        } finally {
            setIsLoadingMessages(false);
        }
    }, []);

    // Load conversations on mount
    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // Load messages when conversation is selected
    useEffect(() => {
        if (selectedPhone) {
            loadConversationMessages(selectedPhone);
        }
    }, [selectedPhone, loadConversationMessages]);

    // Fallback polling - less frequent since we have real-time updates
    // Only polls every 30 seconds as a backup
    useEffect(() => {
        const interval = setInterval(() => {
            loadConversations();
            if (selectedPhone) {
                loadConversationMessages(selectedPhone);
            }
        }, 30000); // 30 seconds instead of 10
        return () => clearInterval(interval);
    }, [selectedPhone, loadConversations, loadConversationMessages]);

    const handleSendChatMessage = async (messageText: string) => {
        if (!selectedPhone) return;

        setIsSendingChat(true);
        try {
            const result = await sendConversationSMS(selectedPhone, messageText);
            if (result.success) {
                await loadConversationMessages(selectedPhone);
                await loadConversations();
            }
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setIsSendingChat(false);
        }
    };

    const handleSelectConversation = (phone: string) => {
        setSelectedPhone(phone);
        setShowNewConversation(false);
    };

    const handleBackToList = () => {
        setSelectedPhone(null);
    };

    const handleStartNewConversation = () => {
        if (newPhoneNumber.trim()) {
            // Format the phone number
            let phone = newPhoneNumber.replace(/\D/g, "");
            if (phone.length === 10) {
                phone = `+1${phone}`;
            } else if (phone.length === 11 && phone.startsWith("1")) {
                phone = `+${phone}`;
            } else if (!phone.startsWith("+")) {
                phone = `+1${phone}`;
            }
            setSelectedPhone(phone);
            setShowNewConversation(false);
            setNewPhoneNumber("");
            setConversationMessages([]);
        }
    };

    return (
        <div className="sms-conversations-page">
            {/* Header */}
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h1>SMS Conversations</h1>
                        <p>Send and receive text messages</p>
                    </div>
                </div>
                <div className="header-actions">
                    <div className={`realtime-status ${isRealtimeConnected ? "connected" : ""}`} title={isRealtimeConnected ? "Real-time updates active" : "Connecting..."}>
                        {isRealtimeConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                    </div>
                    <button
                        onClick={() => setShowNewConversation(true)}
                        className="btn-new-conversation"
                    >
                        <Plus size={16} />
                        New Message
                    </button>
                    <button
                        onClick={loadConversations}
                        className="btn-refresh"
                        disabled={isLoadingConversations}
                    >
                        <RefreshCw size={16} className={isLoadingConversations ? "spin" : ""} />
                    </button>
                </div>
            </header>

            {/* Conversations Container */}
            <div className="conversations-container">
                <div className={`conversations-sidebar ${selectedPhone ? "hidden-mobile" : ""}`}>
                    <div className="conversations-header">
                        <h2>Messages</h2>
                        <span className="conversation-count">{conversations.length}</span>
                    </div>
                    {isLoadingConversations && conversations.length === 0 ? (
                        <div className="loading-state">
                            <Loader2 size={24} className="spin" />
                            <p>Loading conversations...</p>
                        </div>
                    ) : (
                        <ConversationList
                            conversations={conversations}
                            selectedPhone={selectedPhone}
                            onSelectConversation={handleSelectConversation}
                        />
                    )}
                </div>
                <div className={`chat-container ${!selectedPhone && !showNewConversation ? "hidden-mobile" : ""}`}>
                    {showNewConversation ? (
                        <div className="new-conversation-panel">
                            <div className="new-conversation-header">
                                <h3>New Message</h3>
                                <button onClick={() => setShowNewConversation(false)} className="btn-cancel">
                                    Cancel
                                </button>
                            </div>
                            <div className="new-conversation-form">
                                <label>To:</label>
                                <div className="phone-input-wrapper">
                                    <Phone size={18} />
                                    <input
                                        type="tel"
                                        placeholder="Enter phone number"
                                        value={newPhoneNumber}
                                        onChange={(e) => setNewPhoneNumber(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleStartNewConversation();
                                            }
                                        }}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={handleStartNewConversation}
                                    className="btn-start-chat"
                                    disabled={!newPhoneNumber.trim()}
                                >
                                    Start Conversation
                                </button>
                            </div>
                        </div>
                    ) : selectedPhone ? (
                        isLoadingMessages ? (
                            <div className="loading-state chat-loading">
                                <Loader2 size={24} className="spin" />
                                <p>Loading messages...</p>
                            </div>
                        ) : (
                            <ChatView
                                phoneNumber={selectedPhone}
                                messages={conversationMessages}
                                onSendMessage={handleSendChatMessage}
                                onBack={handleBackToList}
                                isSending={isSendingChat}
                            />
                        )
                    ) : (
                        <div className="no-conversation-selected">
                            <MessageCircle size={64} />
                            <h3>Select a conversation</h3>
                            <p>Choose a conversation from the list or start a new one</p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .sms-conversations-page {
                    padding: 1.5rem;
                    max-width: 1200px;
                    margin: 0 auto;
                    height: calc(100vh - 100px);
                    display: flex;
                    flex-direction: column;
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    flex-shrink: 0;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .header-icon {
                    width: 48px;
                    height: 48px;
                    background: var(--primary-soft);
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary);
                }

                .page-header h1 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }

                .page-header p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .realtime-status {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: var(--bg-secondary);
                    color: var(--text-muted);
                    transition: all 0.3s;
                }

                .realtime-status.connected {
                    background: #10b98120;
                    color: #10b981;
                }

                .btn-new-conversation {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    background: var(--primary);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .btn-new-conversation:hover {
                    background: var(--primary-hover);
                }

                .btn-refresh {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .btn-refresh:hover:not(:disabled) {
                    background: var(--bg-hover);
                }

                .btn-refresh:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .conversations-container {
                    display: grid;
                    grid-template-columns: 340px 1fr;
                    gap: 0;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    flex: 1;
                    min-height: 0;
                }

                .conversations-sidebar {
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .conversations-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem;
                    border-bottom: 1px solid var(--border);
                }

                .conversations-header h2 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .conversation-count {
                    font-size: 0.75rem;
                    font-weight: 600;
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    padding: 0.25rem 0.5rem;
                    border-radius: 9999px;
                }

                .chat-container {
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    color: var(--text-muted);
                    gap: 1rem;
                }

                .chat-loading {
                    flex: 1;
                }

                .no-conversation-selected {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    text-align: center;
                    color: var(--text-muted);
                }

                .no-conversation-selected :global(svg) {
                    opacity: 0.2;
                    margin-bottom: 1rem;
                }

                .no-conversation-selected h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                }

                .no-conversation-selected p {
                    font-size: 0.875rem;
                }

                /* New Conversation Panel */
                .new-conversation-panel {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-secondary);
                }

                .new-conversation-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem;
                    background: var(--bg-card);
                    border-bottom: 1px solid var(--border);
                }

                .new-conversation-header h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .btn-cancel {
                    background: none;
                    border: none;
                    color: var(--primary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                }

                .new-conversation-form {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .new-conversation-form label {
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                }

                .phone-input-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.875rem 1rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                }

                .phone-input-wrapper :global(svg) {
                    color: var(--text-muted);
                    flex-shrink: 0;
                }

                .phone-input-wrapper input {
                    flex: 1;
                    background: none;
                    border: none;
                    color: var(--text-primary);
                    font-size: 1rem;
                    outline: none;
                }

                .phone-input-wrapper input::placeholder {
                    color: var(--text-muted);
                }

                .btn-start-chat {
                    padding: 0.875rem;
                    background: var(--primary);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .btn-start-chat:hover:not(:disabled) {
                    background: var(--primary-hover);
                }

                .btn-start-chat:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                @media (max-width: 768px) {
                    .sms-conversations-page {
                        padding: 1rem;
                        height: calc(100vh - 80px);
                    }

                    .page-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 1rem;
                    }

                    .header-actions {
                        width: 100%;
                        justify-content: space-between;
                    }

                    .conversations-container {
                        grid-template-columns: 1fr;
                    }

                    .conversations-sidebar.hidden-mobile {
                        display: none;
                    }

                    .chat-container.hidden-mobile {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
}
