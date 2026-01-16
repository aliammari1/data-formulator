// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import { DataFormulatorState, dfActions } from '../app/dfSlice';
import { useDispatch, useSelector } from 'react-redux';
import { 
    X, 
    Info, 
    ClipboardList, 
    Trash2, 
    ChevronDown, 
    ChevronUp, 
    CheckCircle, 
    AlertCircle, 
    AlertTriangle, 
    InfoIcon 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface Message {
    type: "success" | "info" | "error" | "warning",
    component: string, // the component that generated the message
    timestamp: number,
    value: string,
    detail?: string, // error details
    code?: string // if this message is related to a code error, include code as well
}

export function MessageSnackbar() {
    const messages = useSelector((state: DataFormulatorState) => state.messages);
    const displayedMessageIdx = useSelector((state: DataFormulatorState) => state.displayedMessageIdx);
    
    const dispatch = useDispatch();

    const [openLastMessage, setOpenLastMessage] = React.useState(false);
    const [latestMessage, setLatestMessage] = React.useState<Message | undefined>();

    const [openMessages, setOpenMessages] = React.useState(false);
    const [expandedMessages, setExpandedMessages] = React.useState<string[]>([]);

    // Add ref for messages scroll, so that we always scroll to the bottom of the messages list
    const messagesScrollRef = React.useRef<HTMLDivElement>(null);

    // Original effect for auto-showing new messages
    React.useEffect(()=>{
        if (displayedMessageIdx < messages.length) {
            setOpenLastMessage(true);
            setLatestMessage(messages[displayedMessageIdx]);
            dispatch(dfActions.setDisplayedMessageIndex(displayedMessageIdx + 1));

            // Auto-close after timeout
            const timeout = messages[displayedMessageIdx]?.type === "error" ? 20000 : 10000;
            const timer = setTimeout(() => {
                setOpenLastMessage(false);
                setLatestMessage(undefined);
            }, timeout);
            return () => clearTimeout(timer);
        }
    }, [messages, displayedMessageIdx, dispatch])

    // Simplified useEffect
    React.useEffect(() => {
        messagesScrollRef.current?.scrollTo({ 
            top: messagesScrollRef.current.scrollHeight,
            behavior: 'smooth' 
        });
    }, [messages, openMessages]);

    // Original handler for closing auto-popup messages
    const handleClose = () => {
        setOpenLastMessage(false);
        setLatestMessage(undefined);
    };

    // Helper function to format timestamp
    const formatTimestamp = (timestamp: number) => {
        const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
        return new Date(timestampMs).toLocaleString('en-US', { 
            hour: "2-digit", 
            minute: "2-digit", 
            hour12: false
        });
    };

    const groupedMessages = [];
                            
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const key = `${msg.value}|${msg.detail || ''}|${msg.code || ''}|${msg.type}`;
        
        // Check if this message is the same as the last group
        const lastGroup = groupedMessages[groupedMessages.length - 1];
        const lastKey = lastGroup ? `${lastGroup.value}|${lastGroup.detail || ''}|${lastGroup.code || ''}|${lastGroup.type}` : null;
        
        if (lastKey === key) {
            // Same as previous message, increment count and update timestamp if newer
            lastGroup.count++;
            if (msg.timestamp > lastGroup.timestamp) {
                lastGroup.timestamp = msg.timestamp;
            }
        } else {
            // Different message, create new group
            groupedMessages.push({
                ...msg,
                count: 1,
                originalIndex: i
            });
        }
    }

    const getMessageIcon = (type: string) => {
        switch (type) {
            case "error":
                return <AlertCircle className="h-4 w-4 text-destructive" />;
            case "warning":
                return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
            case "info":
                return <InfoIcon className="h-4 w-4 text-blue-500" />;
            case "success":
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            default:
                return <Info className="h-4 w-4" />;
        }
    };

    const getAlertVariant = (type: string): "default" | "destructive" => {
        return type === "error" ? "destructive" : "default";
    };

    return (
        <div>
            {/* Message Panel Toggle Button */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button 
                        variant="outline"
                        size="icon"
                        className="fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full shadow-lg bg-background hover:scale-110 transition-transform border-yellow-500"
                        onClick={() => setOpenMessages(true)}
                    >
                        <Info className="h-6 w-6 text-yellow-500" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                    View system messages
                </TooltipContent>
            </Tooltip>

            {/* Messages Panel */}
            {openMessages && (
                <div className="fixed bottom-4 right-4 z-50 max-w-[500px] max-h-[70vh]">
                    <Card className="w-full min-w-[300px] py-2 shadow-lg">
                        {/* Header */}
                        <div className="flex items-center px-3">
                            <span className="text-xs flex-grow text-muted-foreground">
                                system messages ({messages.length})
                            </span>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-yellow-500"
                                        onClick={() => {
                                            dispatch(dfActions.clearMessages());
                                            dispatch(dfActions.setDisplayedMessageIndex(0));
                                            setOpenMessages(false);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Clear all messages</TooltipContent>
                            </Tooltip>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setOpenMessages(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <ScrollArea 
                            ref={messagesScrollRef}
                            className="flex-grow max-h-[50vh] min-h-[100px]"
                        >
                            {messages.length === 0 && (
                                <p className="text-xs m-2 opacity-70 italic text-center">
                                    There are no messages yet
                                </p>
                            )}
                            {groupedMessages.map((msg, index) => (
                                <div 
                                    key={index} 
                                    className={cn(
                                        "mb-1 py-1 px-2 mx-1 rounded text-xs",
                                        msg.type === "error" && "bg-destructive/10",
                                        msg.type === "warning" && "bg-yellow-500/10",
                                        msg.type === "info" && "bg-blue-500/10",
                                        msg.type === "success" && "bg-green-500/10"
                                    )}
                                >
                                    <div className="flex items-center gap-1">
                                        {getMessageIcon(msg.type)}
                                        <span className="text-xs">
                                            [{formatTimestamp(msg.timestamp)}] ({msg.component}) - {msg.value}
                                        </span>
                                        {msg.count > 1 && (
                                            <Badge 
                                                variant="outline" 
                                                className={cn(
                                                    "h-4 text-[10px] px-1",
                                                    msg.type === "error" && "border-destructive text-destructive",
                                                    msg.type === "warning" && "border-yellow-500 text-yellow-500",
                                                    msg.type === "info" && "border-blue-500 text-blue-500",
                                                    msg.type === "success" && "border-green-500 text-green-500"
                                                )}
                                            >
                                                x{msg.count}
                                            </Badge>
                                        )}
                                        {(msg.detail || msg.code) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 p-0"
                                                onClick={() => {
                                                    if (expandedMessages.includes(msg.timestamp.toString())) {
                                                        setExpandedMessages(expandedMessages.filter(t => t !== msg.timestamp.toString()));
                                                    } else {
                                                        setExpandedMessages([...expandedMessages, msg.timestamp.toString()]);
                                                    }
                                                }}
                                            >
                                                {expandedMessages.includes(msg.timestamp.toString()) ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                    {(msg.detail || msg.code) && expandedMessages.includes(msg.timestamp.toString()) && (
                                        <div className="ml-5 mt-1">
                                            {msg.detail && (
                                                <>
                                                    <div className="flex items-center gap-2 text-xs opacity-70">
                                                        <Separator className="flex-1" />
                                                        <span>[details]</span>
                                                        <Separator className="flex-1" />
                                                    </div>
                                                    <p className="text-xs mt-1">{msg.detail}</p>
                                                </>
                                            )}
                                            {msg.code && (
                                                <>
                                                    <div className="flex items-center gap-2 text-xs opacity-70 my-1">
                                                        <Separator className="flex-1" />
                                                        <span>[generated code]</span>
                                                        <Separator className="flex-1" />
                                                    </div>
                                                    <pre className="text-[10px] opacity-70 whitespace-pre-wrap break-words">
                                                        {msg.code.split('\n').filter(line => line.trim() !== '').join('\n')}
                                                    </pre>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </ScrollArea>
                    </Card>
                </div>
            )}
            
            {/* Last message toast */}
            {latestMessage && openLastMessage && (
                <div className="fixed bottom-4 right-4 z-[60] max-w-[400px] max-h-[600px] overflow-auto">
                    <Alert variant={getAlertVariant(latestMessage.type)} className="shadow-lg">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                {getMessageIcon(latestMessage.type)}
                                <AlertTitle className="text-xs font-bold">
                                    [{formatTimestamp(latestMessage.timestamp)}] ({latestMessage.component})
                                </AlertTitle>
                                <AlertDescription className="text-xs">
                                    {latestMessage.value}
                                </AlertDescription>
                                
                                {latestMessage.detail && (
                                    <>
                                        <div className="flex items-center gap-2 text-xs opacity-70 my-2">
                                            <Separator className="flex-1" />
                                            <span>[details]</span>
                                            <Separator className="flex-1" />
                                        </div>
                                        <p className="text-xs">{latestMessage.detail}</p>
                                    </>
                                )}
                                
                                {latestMessage.code && (
                                    <>
                                        <div className="flex items-center gap-2 text-xs opacity-70 my-2">
                                            <Separator className="flex-1" />
                                            <span>[generated code]</span>
                                            <Separator className="flex-1" />
                                        </div>
                                        <pre className="text-[10px] opacity-70 whitespace-pre-wrap break-words">
                                            {latestMessage.code.split('\n').filter(line => line.trim() !== '').join('\n')}
                                        </pre>
                                    </>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-2"
                                onClick={handleClose}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </Alert>
                </div>
            )}
        </div>
    );
}
