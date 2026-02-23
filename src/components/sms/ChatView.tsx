"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Phone, ArrowLeft, CheckCircle, Clock, XCircle } from "lucide-react";

interface Message {
    id: string;
    direction?: "INBOUND" | "OUTBOUND";
    from?: string | null;
    to: string;
    message: string;
    status: string;
    createdAt: Date;
    sentBy: { id: string; name: string | null } | null;
}

interface Props {
    phoneNumber: string;
    messages: Message[];
    onSendMessage: (message: string) => Promise<void>;
    onBack?: () => void;
    isSending: boolean;
}

export default function ChatView({ phoneNumber, messages, onSendMessage, onBack, isSending }: Props) {
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const formatPhone = (phone: string) => {
        if (phone.startsWith("+1") && phone.length === 12) {
            return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
        }
        return phone;
    };

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const formatDate = (date: Date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return "Today";
        } else if (days === 1) {
            return "Yesterday";
        } else {
            return d.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
            });
        }
    };

    // Group messages by date
    const groupedMessages = messages.reduce((groups, msg) => {
        const date = new Date(msg.createdAt).toDateString();
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(msg);
        return groups;
    }, {} as Record<string, Message[]>);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        const messageToSend = newMessage;
        setNewMessage("");
        await onSendMessage(messageToSend);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "delivered":
            case "sent":
                return <CheckCircle size={12} className="status-delivered" />;
            case "failed":
            case "undelivered":
                return <XCircle size={12} className="status-failed" />;
            default:
                return <Clock size={12} className="status-pending" />;
        }
    };

    return (
        <div className="chat-view">
            {/* Chat Header */}
            <div className="chat-header">
                {onBack && (
                    <button onClick={onBack} className="back-btn">
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div className="chat-header-avatar">
                    <Phone size={18} />
                </div>
                <div className="chat-header-info">
                    <span className="chat-header-phone">{formatPhone(phoneNumber)}</span>
                    <span className="chat-header-status">{messages.length} messages</span>
                </div>
            </div>

            {/* Messages Container */}
            <div className="messages-container">
                {Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date} className="message-group">
                        <div className="date-divider">
                            <span>{formatDate(new Date(date))}</span>
                        </div>
                        {msgs.map((msg) => (
                            <div
                                key={msg.id}
                                className={`message-wrapper ${msg.direction === "OUTBOUND" ? "outbound" : "inbound"}`}
                            >
                                <div className="message-bubble">
                                    <p className="message-text">{msg.message}</p>
                                    <div className="message-meta">
                                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                                        {msg.direction === "OUTBOUND" && getStatusIcon(msg.status)}
                                    </div>
                                </div>
                                {msg.direction === "OUTBOUND" && msg.sentBy?.name && (
                                    <span className="message-sender">Sent by {msg.sentBy.name}</span>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="chat-input-area">
                <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    disabled={isSending}
                />
                <button type="submit" disabled={!newMessage.trim() || isSending} className="send-btn">
                    {isSending ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
                </button>
            </form>

            <style jsx>{`
                .chat-view {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: var(--bg-secondary);
                }

                .chat-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1rem;
                    background: var(--bg-card);
                    border-bottom: 1px solid var(--border);
                }

                .back-btn {
                    display: none;
                    background: none;
                    border: none;
                    color: var(--primary);
                    cursor: pointer;
                    padding: 0.25rem;
                }

                @media (max-width: 768px) {
                    .back-btn {
                        display: flex;
                    }
                }

                .chat-header-avatar {
                    width: 40px;
                    height: 40px;
                    background: var(--primary-soft);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary);
                }

                .chat-header-info {
                    display: flex;
                    flex-direction: column;
                }

                .chat-header-phone {
                    font-weight: 600;
                    font-size: 0.9375rem;
                    color: var(--text-primary);
                }

                .chat-header-status {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .messages-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .message-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .date-divider {
                    display: flex;
                    justify-content: center;
                    margin: 1rem 0;
                }

                .date-divider span {
                    background: var(--bg-card);
                    padding: 0.375rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.6875rem;
                    font-weight: 500;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .message-wrapper {
                    display: flex;
                    flex-direction: column;
                    max-width: 75%;
                }

                .message-wrapper.outbound {
                    align-self: flex-end;
                    align-items: flex-end;
                }

                .message-wrapper.inbound {
                    align-self: flex-start;
                    align-items: flex-start;
                }

                .message-bubble {
                    padding: 0.625rem 0.875rem;
                    border-radius: 1rem;
                    position: relative;
                }

                .message-wrapper.outbound .message-bubble {
                    background: var(--primary);
                    color: white;
                    border-bottom-right-radius: 0.25rem;
                }

                .message-wrapper.inbound .message-bubble {
                    background: var(--bg-card);
                    color: var(--text-primary);
                    border: 1px solid var(--border);
                    border-bottom-left-radius: 0.25rem;
                }

                .message-text {
                    font-size: 0.875rem;
                    line-height: 1.4;
                    white-space: pre-wrap;
                    word-break: break-word;
                    margin: 0;
                }

                .message-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    margin-top: 0.25rem;
                }

                .message-time {
                    font-size: 0.625rem;
                    opacity: 0.7;
                }

                .message-wrapper.outbound .message-time {
                    color: rgba(255, 255, 255, 0.8);
                }

                .message-wrapper.inbound .message-time {
                    color: var(--text-muted);
                }

                .message-meta :global(.status-delivered) {
                    color: rgba(255, 255, 255, 0.8);
                }

                .message-meta :global(.status-failed) {
                    color: #ff6b6b;
                }

                .message-meta :global(.status-pending) {
                    color: rgba(255, 255, 255, 0.6);
                }

                .message-sender {
                    font-size: 0.625rem;
                    color: var(--text-muted);
                    margin-top: 0.25rem;
                }

                .chat-input-area {
                    display: flex;
                    align-items: flex-end;
                    gap: 0.75rem;
                    padding: 1rem;
                    background: var(--bg-card);
                    border-top: 1px solid var(--border);
                }

                .chat-input-area textarea {
                    flex: 1;
                    padding: 0.75rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 1.5rem;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    font-family: inherit;
                    resize: none;
                    max-height: 120px;
                    line-height: 1.4;
                }

                .chat-input-area textarea:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .chat-input-area textarea::placeholder {
                    color: var(--text-muted);
                }

                .send-btn {
                    width: 44px;
                    height: 44px;
                    background: var(--primary);
                    border: none;
                    border-radius: 50%;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                    flex-shrink: 0;
                }

                .send-btn:hover:not(:disabled) {
                    background: var(--primary-hover);
                    transform: scale(1.05);
                }

                .send-btn:disabled {
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
            `}</style>
        </div>
    );
}
