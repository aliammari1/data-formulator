// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Upload,
    Send,
    RotateCcw,
    XCircle,
    Circle,
    X,
    Table2,
    Link,
    Trash2,
    Bot,
    ArrowDown,
    Globe,
    Image,
    Type,
    Database,
    Square,
    Loader2,
} from 'lucide-react';

import exampleImageTable from "../assets/example-image-table.png";

import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../app/store';
import { DataFormulatorState, dfActions, dfSelectors, fetchFieldSemanticType } from '../app/dfSlice';
import { DataCleanBlock, DataCleanTableOutput } from '../components/ComponentType';
import { getUrls } from '../app/utils';
import { CustomReactTable } from './ReactTable';
import { createTableFromText } from '../data/utils';

// Voice input component
import { VoiceInput } from '@/components/VoiceComponents';

type DialogContentItem = {
    type: 'text';
    text: string;
} | {
    type: 'image_url';
    image_url: {
        url: string;
        detail?: string;
    };
};

type DialogMessage = {
    role: 'user' | 'assistant' | 'system';
    content: string | DialogContentItem[];
};

const generateDefaultName = (seed: string) => {
    const hash = seed.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0) | 0, 0);
    return `data-${Math.abs(hash).toString(36).slice(0, 5)}`;
};

// Sample task card component
const SampleTaskChip: React.FC<{
    task: { text: string; icon?: React.ReactElement; image?: string };
    onClick: () => void;
    disabled?: boolean;
}> = ({ task, onClick, disabled }) => {
    return (
        <div
            className={cn(
                "inline-flex items-center px-2 py-1.5 text-xs min-h-[32px] h-auto rounded-lg",
                "border border-primary/20 shadow-sm transition-all duration-200 ease-in-out",
                "bg-background/90",
                disabled ? "cursor-default opacity-60" : "cursor-pointer hover:shadow-md hover:border-primary/50 hover:-translate-y-px"
            )}
            onClick={disabled ? undefined : onClick}
        >
            {task.image && (
                <img
                    src={task.image}
                    className="w-6 h-6 object-cover rounded mr-2 border border-border"
                    alt=""
                />
            )}
            <span className="text-xs text-foreground leading-snug">
                {task.text}
            </span>
        </div>
    );
};

export const DataPreviewBox: React.FC<{className?: string}> = ({className}) => {

    const dispatch = useDispatch<AppDispatch>();
    const dataCleanBlocks = useSelector((state: DataFormulatorState) => state.dataCleanBlocks);
    const focusedDataCleanBlockId = useSelector((state: DataFormulatorState) => state.focusedDataCleanBlockId);
    const existingTables = useSelector((state: DataFormulatorState) => state.tables);
    
    let selectedBlock = dataCleanBlocks.find(block => block.id === focusedDataCleanBlockId?.blockId) || dataCleanBlocks[dataCleanBlocks.length - 1];
    let selectedTable = focusedDataCleanBlockId ? selectedBlock?.items?.[focusedDataCleanBlockId.itemId] : undefined;

    if (!selectedTable) {
        return (
            <div className={cn("p-2 flex flex-col gap-2 border rounded-md", className)}>
                <p className="text-[10px] text-muted-foreground">
                    No data selected
                </p>
            </div>
        );
    }

    if (selectedTable.content.type === 'csv' && selectedTable.content.value) {
        const suggestedName = selectedTable.name || generateDefaultName(selectedTable.content.value.slice(0, 96));
        const tableComponent = createTableFromText(suggestedName, selectedTable.content.value);
        if (tableComponent) {
            return <CustomReactTable
                rows={tableComponent.rows}
                rowsPerPageNum={-1}
                compact={false}
                columnDefs={tableComponent.names.map((name) => ({
                    id: name,
                    label: name,
                    minWidth: 60,
                    align: undefined,
                    format: (v: any) => v,
                }))}
                maxHeight={600}
            />
        }
        return (
            <div className={cn("p-2 flex flex-col gap-2 border rounded-md", className)}>
                <p className="text-[10px] text-muted-foreground">
                    {selectedTable.content.value}
                </p>
            </div>
        );
    }
    
    // Handle image_url content type
    if (selectedTable.content.type === 'image_url') {
        return (
            <div className={cn("p-2 flex flex-col gap-2 border rounded-md", className)}>
                <p className="text-[10px] text-muted-foreground">
                    Image URL: {selectedTable.content.value}
                </p>
                <img
                    src={selectedTable.content.value}
                    alt={`Image from ${selectedTable.name || 'data source'}`}
                    className="max-w-full max-h-[400px] object-contain rounded"
                />
            </div>
        );
    }
    
    // Handle data_url content type
    if (selectedTable.content.type === 'web_url') {
        return (
            <div className={cn("p-2 flex flex-col gap-2 border rounded-md", className)}>
                <p className="text-xs text-foreground font-medium">
                    Data URL
                </p>
                <p className="text-[10px] text-muted-foreground break-all">
                    {selectedTable.content.value}
                </p>
            </div>
        );
    }
    
    // Fallback for other content types
    return (
        <div className={cn("p-2 flex flex-col gap-2 border rounded-md", className)}>
            <p className="text-[10px] text-muted-foreground">
                {selectedTable.content.value}
            </p>
        </div>
    );
}

export const DataLoadingInputBox = React.forwardRef<(() => void) | null, {maxLines?: number, onStreamingContentUpdate?: (content: string) => void, abortControllerRef?: React.MutableRefObject<AbortController | null>}>(({maxLines = 4, onStreamingContentUpdate, abortControllerRef}, ref) => {
    const dispatch = useDispatch<AppDispatch>();
    const activeModel = useSelector(dfSelectors.getActiveModel);
    const dataCleanBlocks = useSelector((state: DataFormulatorState) => state.dataCleanBlocks);
    const cleanInProgress = useSelector((state: DataFormulatorState) => state.cleanInProgress);

    const focusedDataCleanBlockId = useSelector((state: DataFormulatorState) => state.focusedDataCleanBlockId);
    let selectedBlock = focusedDataCleanBlockId ? dataCleanBlocks.find(block => block.id === focusedDataCleanBlockId.blockId) : undefined;
    let selectedTable = focusedDataCleanBlockId ? selectedBlock?.items?.[focusedDataCleanBlockId.itemId] : undefined;

    const [userImages, setUserImages] = useState<string[]>([]);
    const [prompt, setPrompt] = useState('');

    const existOutputBlocks = dataCleanBlocks.length > 0;

    // Reconstruct dialog from Redux state for API compatibility
    const dialog: DialogMessage[] = (() => {
        const reconstructedDialog: DialogMessage[] = [];
        
        // Build dialog backwards from selected block until there's no parent
        let currentBlockId = focusedDataCleanBlockId?.blockId;
        const processedBlocks = new Set<string>();
        
        while (currentBlockId && !processedBlocks.has(currentBlockId)) {
            const block = dataCleanBlocks.find(b => b.id === currentBlockId);
            if (!block) break;
            
            processedBlocks.add(currentBlockId);
            
            // Add user message from block's derive field
            const content: any[] = [];
            if (block.derive.prompt) {
                content.push({ type: 'text', text: block.derive.prompt });
            }
            if (block.derive.artifacts) {
                block.derive.artifacts.forEach(artifact => {
                    if (artifact.type === 'image_url') {
                        content.push({ 
                            type: 'image_url', 
                            image_url: { url: artifact.value } 
                        });
                    }
                });
            }
            reconstructedDialog.unshift({
                role: 'user',
                content: content.length === 1 && content[0].type === 'text' ? content[0].text : content
            });
            
            // Add assistant message if dialogItem exists
            if (block.dialogItem) {
                reconstructedDialog.unshift(block.dialogItem);
            }
            
            // Move to parent block
            currentBlockId = block.derive.sourceId;
        }
        
        return reconstructedDialog;
    })();

    // Define sample tasks
    const sampleTasks = [
        {
            text: "Extract top repos from https://github.com/microsoft",
            fullText: "extract the top repos information from https://github.com/microsoft?q=&type=all&language=&sort=stargazers",
            icon: <Globe className="w-[18px] h-[18px]" />
        },
        {
            text: "Extract data from this image",
            fullText: "help me extract data from this image",
            icon: <Image className="w-[18px] h-[18px]" />,
            image: exampleImageTable
        },
        {
            text: "Extract growth data from text",
            fullText: `help me extract sub-segment growth data from this text\n\n\"Revenue in Productivity and Business Processes was $33.1 billion and increased 16% (up 14% in constant currency), with the following business highlights:
·        Microsoft 365 Commercial products and cloud services revenue increased 16% (up 15% in constant currency) driven by Microsoft 365 Commercial cloud revenue growth of 18% (up 16% in constant currency)
·        Microsoft 365 Consumer products and cloud services revenue increased 21% driven by Microsoft 365 Consumer cloud revenue growth of 20%
·        LinkedIn revenue increased 9% (up 8% in constant currency)
·        Dynamics products and cloud services revenue increased 18% (up 17% in constant currency) driven by Dynamics 365 revenue growth of 23% (up 21% in constant currency)

Revenue in Intelligent Cloud was $29.9 billion and increased 26% (up 25% in constant currency), with the following business highlights:
·        Server products and cloud services revenue increased 27% driven by Azure and other cloud services revenue growth of 39%

Revenue in More Personal Computing was $13.5 billion and increased 9%, with the following business highlights:
·        Windows OEM and Devices revenue increased 3%
·        Xbox content and services revenue increased 13% (up 12% in constant currency)
·        Search and news advertising revenue excluding traffic acquisition costs increased 21% (up 20% in constant currency)\"`,
            icon: <Type className="w-[18px] h-[18px]" />
        },
        {
            text: "Generate UK dynasty dataset",
            fullText: "help me generate a dataset about uk dynasty with their years of reign and their monarchs",
            icon: <Database className="w-[18px] h-[18px]" />
        }
    ];

    const placeholder = (existOutputBlocks) 
        ? (selectedTable && selectedTable.content.type === 'image_url' 
            ? "extract data from this image" 
            : "follow-up instruction (e.g., fix headers, remove totals, generate 15 rows, etc.)")
        : "paste the content (website, image, text block, etc.) and ask AI to extract / clean data from it";

    let additionalImages = (() => {
        if (selectedTable && selectedTable.content.type === 'image_url') {
            return [selectedTable.content.value];
        }
        return [];
    })();

    const canSend = (() => {
        // Allow sending if there's prompt text or image data
        const hasPrompt = prompt.trim().length > 0;
        const hasImageData = userImages.length > 0 || additionalImages.length > 0;
        return (hasPrompt || hasImageData) && !cleanInProgress;
    })();

    // Function to extract URLs from the current prompt
    const extractedUrls = (() => {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const matches = prompt.match(urlRegex);
        if (!matches) return [];
        
        // Remove trailing commas and periods from URLs
        const cleanedUrls = matches.map(url => {
            return url.replace(/[,.]$/, '');
        });
        
        return [...new Set(cleanedUrls)]; // Remove duplicates
    })();

    const handlePasteImage = (e: React.ClipboardEvent<HTMLDivElement>) => {
        if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
            const files = Array.from(e.clipboardData.files);
            const imageFiles = files.filter(file => file.type.startsWith('image/'));
            
            if (imageFiles.length > 0) {
                const newImages: string[] = [];
                let processedCount = 0;
                
                imageFiles.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const res = reader.result as string;
                        if (res) {
                            newImages.push(res);
                        }
                        processedCount++;
                        
                        if (processedCount === imageFiles.length) {
                            setUserImages(prev => [...prev, ...newImages]);
                        }
                    };
                    reader.readAsDataURL(file);
                });
            }
        }
    };

    const removeImage = (index: number) => {
        setUserImages(prev => prev.filter((_, i) => i !== index));
    };

    const stopGeneration = () => {
        if (abortControllerRef?.current) {
            abortControllerRef.current.abort();
        }
    };

    const sendRequest = (promptToUse: string, imagesToUse: string[]) => {        
        // Check if we can send with the provided or state values
        const hasPrompt = promptToUse.trim().length > 0;
        const hasImageData = imagesToUse.length > 0 || additionalImages.length > 0;
        if (!hasPrompt && !hasImageData) return;
        if (cleanInProgress) return;
        
        dispatch(dfActions.setCleanInProgress(true));
        const token = String(Date.now());

        let prompt_to_send = promptToUse.trim() || (hasImageData ? 'extract data from the image' : 'let\'s generate some interesting data');
        let images_to_send = [...additionalImages, ...imagesToUse];

        // Extract URLs from the prompt
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const matches = prompt_to_send.match(urlRegex);
        const extractedUrlsFromPrompt = matches ? [...new Set(matches)] : [];

        // Construct payload - simplified to match backend API
        const payload: any = {
            token,
            model: activeModel,
            prompt: prompt_to_send,
            artifacts: [
                ...images_to_send.map(image => ({ type: 'image_url', content: image })),
                ...extractedUrlsFromPrompt.map(url => ({ type: 'web_url', content: url })),
            ],
            dialog: dialog
        };

        // Create abort controller
        const controller = new AbortController();
        if (abortControllerRef) {
            abortControllerRef.current = controller;
        }

        fetch(getUrls().CLEAN_DATA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let finalResult: any = null;

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    onStreamingContentUpdate?.(buffer);

                    // Split by newlines to get individual JSON objects
                    const lastLine = buffer.split('\n').filter(line => line.trim() !== "").pop();

                    // Process each line
                    if (lastLine) {
                        try {
                            const data = JSON.parse(lastLine);
                            if (data.status === "ok" && data.content) {
                                finalResult = data;
                                break;
                            } 
                        } catch (parseError) {
                            continue
                        }
                    }
                }

                if (finalResult && finalResult.status === 'ok' && finalResult.content) {
                    const tables = finalResult.content;
                    const updatedDialog = finalResult.dialog || [];
                    
                    // Create new DataCleanBlock
                    const newBlock: DataCleanBlock = {
                        id: `block-${Date.now()}`,
                        items: tables,
                        derive: {
                            sourceId: focusedDataCleanBlockId?.blockId,
                            prompt: prompt_to_send,
                            artifacts: [
                                ...images_to_send.map(image => ({ type: 'image_url' as const, value: image })),
                                ...extractedUrls.map(url => ({ type: 'web_url' as const, value: url })),
                            ]
                        },
                        dialogItem: updatedDialog.length > 0 ? updatedDialog[updatedDialog.length - 1] : undefined
                    };
                    
                    onStreamingContentUpdate?.('');
                    dispatch(dfActions.addDataCleanBlock(newBlock));
                    dispatch(dfActions.setFocusedDataCleanBlockId({blockId: newBlock.id, itemId: 0}));
                    
                    // Clear input fields only after successful completion
                    setPrompt('');
                    setUserImages([]);
                } else {
                    // Generation failed
                    dispatch(dfActions.addMessages({
                        timestamp: Date.now(),
                        type: 'error',
                        component: 'data loader',
                        value: finalResult?.content || 'Unable to extract tables from response',
                    }));
                    // Clear input fields only after failed completion
                    setPrompt('');
                    onStreamingContentUpdate?.('');
                    setUserImages([]);
                }
            } finally {
                reader.releaseLock();
                dispatch(dfActions.setCleanInProgress(false));
                if (abortControllerRef) {
                    abortControllerRef.current = null;
                }
            }
        })
        .catch((error) => {
            dispatch(dfActions.setCleanInProgress(false));
            if (abortControllerRef) {
                abortControllerRef.current = null;
            }
            
            // Check if this was an abort (user stopped the generation)
            if (error.name === 'AbortError') {
                dispatch(dfActions.addMessages({
                    timestamp: Date.now(),
                    type: 'info',
                    component: 'data loader',
                    value: 'Generation stopped by user',
                }));
            } else {
                // Generation failed
                const errorMessage = `Server error while processing data: ${error.message}`;
                dispatch(dfActions.addMessages({
                    timestamp: Date.now(),
                    type: 'error',
                    component: 'data loader',
                    value: errorMessage,
                }));
            }
            
            // Clear input fields only after failed completion
            setPrompt('');
            setUserImages([]);
            onStreamingContentUpdate?.('');
        });
    };

    // Expose sendRequest function to parent via ref
    React.useEffect(() => {
        if (ref && typeof ref === 'object' && 'current' in ref) {
            ref.current = () => sendRequest(prompt, userImages);
        }
    }, [canSend, prompt, additionalImages, userImages, extractedUrls, dialog, activeModel, focusedDataCleanBlockId, dispatch]);

    let inputImages = [...userImages, ...additionalImages];

    return (
        <div className="py-2 relative flex flex-row gap-2 items-end">
            {cleanInProgress && (
                <div className="absolute inset-0 z-10 pointer-events-none opacity-10">
                    <Progress value={undefined} className="w-full h-full" />
                </div>
            )}
            <div className="flex-1 relative">
            
            {/* HTML Address Chips */}
            {extractedUrls.length > 0 && (
                <div className="flex flex-row flex-wrap gap-1 mb-2 relative">
                    {extractedUrls.map((url, index) => (
                        <Badge
                            key={index}
                            variant="outline"
                            className={cn(
                                "bg-primary/5 border-primary/20 text-primary rounded-lg",
                                existOutputBlocks ? "max-w-[280px] text-[11px]" : "max-w-[400px] text-xs"
                            )}
                        >
                            <Link className="w-4 h-4 mr-1" />
                            <span className="truncate">
                                {url.length > 50 ? `${url.substring(0, 47)}...` : url}
                            </span>
                        </Badge>
                    ))}
                </div>
            )}

            {inputImages.length > 0 && (
                <div className="flex flex-row flex-wrap gap-1 mt-1 relative">
                    {inputImages.map((imageUrl, index) => (
                        <div key={index} className="block relative">
                            <img
                                src={imageUrl}
                                alt={`Pasted image ${index + 1}`}
                                className={cn(
                                    "object-cover rounded border border-border",
                                    existOutputBlocks ? "max-h-[60px]" : "max-h-[600px]",
                                    inputImages.length > 1 ? "max-w-[30%]" : "max-w-[600px]"
                                )}
                            />
                            {userImages.includes(imageUrl) ? (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-0 right-0 h-6 w-6"
                                    onClick={() => removeImage(index)}
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            ) : (
                                <span className="text-[10px] text-muted-foreground absolute top-0 right-0 w-4 h-4 flex items-center justify-center">
                                    ➤
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
            
            <div className="relative">
                <Textarea
                    className={cn(
                        "resize-none border-0 border-b focus-visible:ring-0 rounded-none",
                        existOutputBlocks ? "text-xs" : "text-sm"
                    )}
                    placeholder={cleanInProgress ? 'extracting data...' : placeholder}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={cleanInProgress}
                    autoComplete="off"
                    rows={Math.min(maxLines, Math.max(1, prompt.split('\n').length))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendRequest(prompt, userImages);
                        }
                    }}
                    onPaste={handlePasteImage}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                    {cleanInProgress ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={stopGeneration}
                                    >
                                        <Square className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Stop generation</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <>
                            <VoiceInput 
                                onTranscription={(text) => {
                                    setPrompt(prev => prev ? `${prev} ${text}` : text);
                                }}
                                disabled={cleanInProgress}
                            />
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary"
                                disabled={!canSend} 
                                onClick={() => sendRequest(prompt, userImages)}
                            >
                                <Bot className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            </div>
            
            {/* Sample Task Cards - Show only when no output blocks exist and not processing */}
            {!existOutputBlocks && !cleanInProgress && (
                <div className="mt-4 mb-2">
                    <p className="text-[11px] text-muted-foreground mb-2">
                        examples
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {sampleTasks.map((task, index) => (
                            <SampleTaskChip
                                key={index}
                                task={task}
                                onClick={async () => {
                                    let imagesToSend: string[] = [];
                                    
                                    if (task.image) {
                                        // Convert example image to data URL
                                        try {
                                            const response = await fetch(task.image);
                                            const blob = await response.blob();
                                            const reader = new FileReader();
                                            
                                            await new Promise<void>((resolve) => {
                                                reader.onload = () => {
                                                    const dataUrl = reader.result as string;
                                                    imagesToSend = [dataUrl];
                                                    setUserImages([dataUrl]);
                                                    resolve();
                                                };
                                                reader.readAsDataURL(blob);
                                            });
                                        } catch (error) {
                                            console.error('Failed to load image:', error);
                                        }
                                    }
                                    
                                    // Set prompt for display
                                    setPrompt(task.fullText);
                                    
                                    // Call sendRequest with explicit parameters
                                    sendRequest(task.fullText, imagesToSend);
                                }}
                                disabled={cleanInProgress}
                            />
                        ))}
                    </div>
                </div>
            )}
            </div>
        </div>
    );
});

// Utility function to convert dataCleanBlocks into ordered threadBlocks
export interface ThreadBlock {
    threadIndex: number;
    blocks: DataCleanBlock[];
    leafBlock: DataCleanBlock;
}

export const createOrderedThreadBlocks = (dataCleanBlocks: DataCleanBlock[]): ThreadBlock[] => {
    // Helper function to get the path from root to a block
    const getBlockPath = (blockId: string): DataCleanBlock[] => {
        const path: DataCleanBlock[] = [];
        let currentBlock = dataCleanBlocks.find(b => b.id === blockId);
        
        while (currentBlock) {
            path.unshift(currentBlock);
            currentBlock = dataCleanBlocks.find(b => b.id === currentBlock?.derive.sourceId);
        }
        
        return path;
    };

    // Identify leaf blocks (blocks that have no children)
    const getLeafBlocks = (): DataCleanBlock[] => {
        return dataCleanBlocks.filter(block => {
            // A block is a leaf if no other block has it as a parent
            return !dataCleanBlocks.some(otherBlock => otherBlock.derive.sourceId === block.id);
        });
    };

    // Get blocks that should be displayed in a thread (avoiding repetition)
    const getThreadBlocks = (leafBlock: DataCleanBlock, usedBlockIds: Set<string>): DataCleanBlock[] => {
        const path = getBlockPath(leafBlock.id);
        
        // Find the first block in the path that hasn't been used in previous threads
        let startIndex = 0;
        for (let i = 0; i < path.length; i++) {
            if (!usedBlockIds.has(path[i].id)) {
                startIndex = i;
                break;
            }
        }
        
        return path.slice(startIndex);
    };

    // Sort leaf blocks by their creation order (using block IDs which contain timestamps)
    const leafBlocks = getLeafBlocks().sort((a, b) => {
        const aTime = parseInt(a.id.split('-')[1] || '0');
        const bTime = parseInt(b.id.split('-')[1] || '0');
        return aTime - bTime;
    });

    // Build threads
    const threads: ThreadBlock[] = leafBlocks.map((leafBlock, threadIndex) => {
        const usedBlockIds = new Set<string>();
        
        // Collect all block IDs used in previous threads
        for (let i = 0; i < threadIndex; i++) {
            const previousThreadBlocks = getThreadBlocks(leafBlocks[i], new Set());
            previousThreadBlocks.forEach(block => usedBlockIds.add(block.id));
        }
        
        const threadBlocks = getThreadBlocks(leafBlock, usedBlockIds);
        
        return {
            threadIndex,
            blocks: threadBlocks,
            leafBlock
        };
    });

    return threads;
};


export const SingleDataCleanThreadView: React.FC<{thread: ThreadBlock, className?: string}> = ({thread, className}) => {
    const {threadIndex, blocks, leafBlock} = thread;

    const dispatch = useDispatch<AppDispatch>();
    const focusedDataCleanBlockId = useSelector((state: DataFormulatorState) => state.focusedDataCleanBlockId);

    let isThreadFocused = blocks.some(block => block.id === focusedDataCleanBlockId?.blockId);

    return (
        <div className={cn(
            "flex flex-col gap-0 mb-4 rounded-lg transition-all duration-200 ease-in-out",
            className
        )}>
            {/* Thread header */}
            <div className="flex mx-0.5 mb-2">
                <div className="flex items-center w-full">
                    <div className="flex-1 border-t-2 border-border/20 w-[60px]" />
                    <span className="px-2 text-[10px] text-muted-foreground">
                        {`loading - ${threadIndex + 1}`}
                    </span>
                    <div className="flex-1 border-t-2 border-border/20 w-[60px]" />
                </div>
            </div>
            
            {/* Thread content */}
            {blocks.map((block, blockIndex) => {
                const isLastBlock = blockIndex === blocks.length - 1;
                
                return (
                    <div key={block.id} className="flex flex-col gap-0">
                        {/* Start circle for the first block */}
                        {blockIndex === 0 && (
                            <div className="flex items-center ml-[5px]">
                                <Circle className="w-[7px] h-[7px] text-gray-400" />
                            </div>
                        )}
                        
                        <div className={cn(
                            "py-1.5 px-2 flex items-center",
                            blockIndex === 0 ? "py-1" : "py-3",
                            isThreadFocused 
                                ? "border-l-[3px] border-primary/60 ml-[7px]" 
                                : "border-l border-dashed border-black/30 ml-2"
                        )} />

                        {/* User Instruction Card (styled like TriggerCard) */}
                        <Card className="bg-accent/5 text-[10px] flex flex-row items-center gap-0.5">
                            <Bot className="ml-2 text-gray-400 w-[14px] h-[14px]" />
                            <div className="m-1 mr-2">
                                {/* Text prompt */}
                                {block.derive.prompt && (
                                    <p className="text-[10px] text-center text-balance min-w-[40px] text-black/70 overflow-auto text-ellipsis break-words max-h-[100px]">
                                        "{block.derive.prompt}"
                                    </p>
                                )}
                                
                                {/* Images if present */}
                                {block.derive.artifacts && block.derive.artifacts.filter(a => a.type === 'image_url').length > 0 && (
                                    <div className="flex flex-wrap gap-1 py-1">
                                        {block.derive.artifacts
                                            .filter(artifact => artifact.type === 'image_url')
                                            .map((artifact, imgIndex) => (
                                            <img
                                                key={imgIndex}
                                                src={artifact.value}
                                                alt={`User uploaded image ${imgIndex + 1}`}
                                                className="w-auto h-10 max-w-[100px] object-cover rounded-sm border border-border"
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                        
                        {/* Down arrow connecting instruction to output */}
                        <div className="flex items-center">
                            <ArrowDown className={cn(
                                "w-4 h-4 ml-1",
                                isThreadFocused ? "text-primary" : "text-muted-foreground"
                            )} />
                        </div>
                        
                        {/* Output Cards (styled like primary colored cards) */}
                        {block.items?.map((table, itemId) => {
                            const isItemSelected = block.id === focusedDataCleanBlockId?.blockId && itemId === focusedDataCleanBlockId.itemId;
                            return (
                                <Card
                                    key={itemId}
                                    className={cn(
                                        "py-0 cursor-pointer bg-primary/10 hover:shadow hover:translate-y-px transition-all",
                                        itemId === 0 ? "mt-0" : "mt-1",
                                        isItemSelected 
                                            ? "border-2 border-primary/60" 
                                            : "border border-gray-300"
                                    )}
                                    onClick={() => dispatch(dfActions.setFocusedDataCleanBlockId({blockId: block.id, itemId: itemId}))}
                                >
                                    <div className="flex py-1">
                                        <div className="flex flex-row gap-0.5 ml-1 mr-auto text-xs w-[calc(100%-8px)] items-center">
                                            {table.content.type === 'csv' && <Table2 className="text-gray-400 w-[14px] h-[14px]" />}
                                            {table.content.type === 'image_url' && <Link className="text-gray-400 w-[14px] h-[14px]" />}
                                            {table.content.type === 'web_url' && <Link className="text-gray-400 w-[14px] h-[14px]" />}
                                            <span className="text-xs ml-1 text-black/70 overflow-hidden text-ellipsis line-clamp-2">
                                                {table.name}
                                            </span>
                                            {isLastBlock && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="ml-auto p-0.5 h-6 w-6 hover:scale-110 transition-all duration-200"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    dispatch(dfActions.removeDataCleanBlocks({ blockIds: [block.id] })) 
                                                                }}
                                                            >
                                                                <Trash2 className="w-[18px] h-[18px] text-amber-500" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>delete table</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};


export const DataLoadingThread: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dataCleanBlocks = useSelector((state: DataFormulatorState) => state.dataCleanBlocks);

    // Use the utility function to create ordered thread blocks
    const threads = createOrderedThreadBlocks(dataCleanBlocks);

    let threadDisplay = (
        <div className="flex-1 w-[calc(100%-8px)] p-1 flex flex-col max-h-[400px] overflow-y-auto overflow-x-hidden">
            {/* Render each thread */}
            {threads.map((thread) => (
                <SingleDataCleanThreadView key={`thread-${thread.threadIndex}`} thread={thread} />
            ))}
        </div>
    );

    return threadDisplay;
};