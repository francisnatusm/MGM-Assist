import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Building2 } from 'lucide-react';
import { apiUrl } from '../lib/api';

const ChatbotOverlay = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { type: 'incoming', text: 'Hi there 👋\nI am MGM Assist. How can I help you in Montgomery today?' }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const chatboxRef = useRef(null);

    useEffect(() => {
        if (chatboxRef.current) {
            chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async () => {
        const userMessage = input.trim();
        if (!userMessage) return;

        setInput('');
        setMessages(prev => [...prev, { type: 'outgoing', text: userMessage }]);
        setIsTyping(true);

        try {
            const response = await fetch(apiUrl('/api/chat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Something went wrong');

            setMessages(prev => [...prev, { type: 'incoming', text: data.message }]);
        } catch (error) {
            setMessages(prev => [...prev, { type: 'error', text: error.message }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div 
            className="fixed z-[9999] flex flex-col items-center pointer-events-auto"
            style={{
                bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
                right: 'max(1rem, env(safe-area-inset-right, 0px))',
            }}
        >
            <div className="mb-2 pointer-events-none">
                <span className="text-xs font-semibold tracking-wide bg-mgm-card/95 text-mgm-gold border border-gray-700 px-2.5 py-1 rounded-full shadow-lg">
                    Chat with MGM AI
                </span>
            </div>

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 bg-mgm-gold hover:bg-yellow-500 text-mgm-navy rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95 relative z-[9999]"
            >
                {isOpen ? <X className="w-7 h-7" /> : <MessageSquare className="w-7 h-7" />}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="absolute bottom-20 right-0 w-[90vw] md:w-[400px] h-[500px] md:h-[550px] max-h-[85vh] bg-mgm-card rounded-2xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 z-[9998]">
                    {/* Header */}
                    <div className="bg-mgm-navy px-5 py-4 flex justify-between items-center border-b border-gray-800">
                        <div className="flex items-center gap-3 text-white">
                            <div className="bg-mgm-blue/20 p-2 rounded-lg">
                                <Building2 className="w-5 h-5 text-mgm-blue" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-mgm-gold">MGM Assist</h3>
                                <p className="text-xs text-mgm-cyan">City Intelligence AI</p>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div ref={chatboxRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-mgm-navy/30">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                                {msg.type !== 'outgoing' && (
                                    <div className="w-8 h-8 rounded-full bg-mgm-blue/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1 pb-1">
                                        <Building2 className="w-4 h-4 text-mgm-blue" />
                                    </div>
                                )}
                                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap text-sm shadow-sm ${msg.type === 'outgoing'
                                        ? 'bg-mgm-gold text-mgm-navy rounded-br-sm'
                                        : msg.type === 'error'
                                            ? 'bg-mgm-red/20 text-red-200 border border-mgm-red/50 rounded-bl-sm'
                                            : 'bg-mgm-card border border-gray-700 text-gray-200 rounded-bl-sm'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="w-8 h-8 rounded-full bg-mgm-blue/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1 pb-1">
                                    <Building2 className="w-4 h-4 text-mgm-blue" />
                                </div>
                                <div className="bg-mgm-card border border-gray-700 text-gray-400 rounded-2xl rounded-bl-sm px-4 py-3 text-sm flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-mgm-card border-t border-gray-800">
                        <div className="relative flex items-end bg-mgm-navy border border-gray-700 rounded-xl focus-within:border-mgm-cyan transition-colors shadow-inner">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about Montgomery services..."
                                className="w-full bg-transparent text-gray-200 p-3 max-h-32 min-h-[48px] resize-none focus:outline-none text-sm leading-relaxed"
                                rows={1}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isTyping}
                                className="m-2 p-2 rounded-lg bg-mgm-blue hover:bg-mgm-cyan text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="text-center mt-2">
                            <span className="text-[10px] text-gray-500 opacity-60">Powered by Claude AI & Bright Data</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatbotOverlay;
