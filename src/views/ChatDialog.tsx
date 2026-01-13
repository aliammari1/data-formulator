// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FC, useRef, useEffect } from 'react'
import React from 'react';
import { CodeBox } from './VisualizationView';

import { 
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, User, Bot, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { VoiceOutput } from '@/components/VoiceComponents';

export const GroupHeader = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div 
        className={cn(
            "sticky -top-2 p-1 text-xs text-muted-foreground",
            className
        )} 
        {...props}
    >
        {children}
    </div>
);

export const GroupItems = ({ children, className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className={cn("p-0", className)} {...props}>
        {children}
    </ul>
);

// Function to parse message content and render code blocks
const renderMessageContent = (role: string, message: string) => {
    // Split message by code blocks (```language ... ```)
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(message)) !== null) {
        // Add text before code block
        if (match.index > lastIndex) {
            const textContent = message.slice(lastIndex, match.index);
            if (textContent.trim()) {
                parts.push(
                    <p key={`text-${lastIndex}`} className="text-sm whitespace-pre-wrap leading-relaxed mb-2">
                        {textContent}
                    </p>
                );
            }
        }

        // Add code block
        const language = match[1] || 'text';
        const code = match[2].trim();
        parts.push(
            <div key={`code-${match.index}`} className="my-2 rounded-lg overflow-auto">
                <CodeBox code={code} language={language} fontSize={10} />
            </div>
        );

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last code block
    if (lastIndex < message.length) {
        const textContent = message.slice(lastIndex);
        if (textContent.trim()) {
            parts.push(
                <p key={`text-${lastIndex}`} className="text-sm whitespace-pre-wrap leading-relaxed">
                    {textContent}
                </p>
            );
        }
    }

    // If no code blocks found, return original message
    if (parts.length === 0) {
        return (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {message}
            </p>
        );
    }

    return <div className="space-y-1">{parts}</div>;
};

export interface ChatDialogProps {
    code: string, // final code generated
    dialog: any[],
    open: boolean,
    handleCloseDialog: () => void,
}

export const ChatDialog: FC<ChatDialogProps> = function ChatDialog({code, dialog, open, handleCloseDialog}) {
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when dialog opens
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                if (scrollAreaRef.current) {
                    scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [open]);

    let body = undefined;
    if (dialog == undefined) {
        body = (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <MessageCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                    No conversation yet
                </p>
                <p className="text-xs text-muted-foreground">
                    Start a conversation to see the dialog here
                </p>
            </div>
        );
    } else {
        body = (
            <div className="flex flex-col gap-4 py-4">
                {/* filter out system messages */}
                {dialog.filter(entry => entry["role"] != 'system').map((chatEntry, idx) => {
                    let role = chatEntry['role'];
                    let message: string = chatEntry['content'] as string;
                    const isUser = role === 'user';

                    message = message.trimEnd();

                    return (
                        <div 
                            key={`chat-dialog-${idx}`}
                            className={cn(
                                "flex gap-3",
                                isUser && "flex-row-reverse"
                            )}
                        >
                            {/* Avatar */}
                            <div className={cn(
                                "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                                isUser ? "bg-foreground" : "bg-muted"
                            )}>
                                {isUser 
                                    ? <User className="h-4 w-4 text-background" />
                                    : <Bot className="h-4 w-4 text-muted-foreground" />
                                }
                            </div>
                            
                            {/* Message Bubble */}
                            <div className={cn(
                                "flex-1 rounded-xl px-4 py-3",
                                isUser 
                                    ? "bg-primary text-primary-foreground" 
                                    : "bg-muted text-foreground"
                            )}>
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="text-xs font-medium opacity-70">
                                        {isUser ? 'You' : 'Assistant'}
                                    </span>
                                    {/* Voice output for assistant messages */}
                                    {!isUser && (
                                        <VoiceOutput 
                                            text={message.replace(/```[\s\S]*?```/g, '')} 
                                            className="opacity-60 hover:opacity-100"
                                        />
                                    )}
                                </div>
                                <div className="text-sm whitespace-pre-wrap wrap-break-word">
                                    {renderMessageContent(role, message)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCloseDialog()}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="shrink-0 px-6 py-4 border-b border-border">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <MessageCircle className="h-4 w-4" />
                        Conversation
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        View the conversation history with the AI assistant
                    </DialogDescription>
                </DialogHeader>
                
                <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-6">
                    {body}
                </div>
                
                <DialogFooter className="shrink-0 px-6 py-4 border-t border-border bg-muted/30">
                    <Button onClick={handleCloseDialog} variant="outline" size="sm" className="gap-1.5">
                        <X className="h-3.5 w-3.5" />
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}