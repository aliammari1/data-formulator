// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RotateCcw, X, FileUp, ImagePlus, Loader2 } from 'lucide-react';

import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../app/store';
import { DataFormulatorState, dfActions, fetchFieldSemanticType } from '../app/dfSlice';
import { createTableFromText } from '../data/utils';
import { createOrderedThreadBlocks, DataLoadingInputBox, DataPreviewBox, SingleDataCleanThreadView } from './DataLoadingThread';


const generateDefaultName = (seed: string) => {
    const hash = seed.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0) | 0, 0);
    return `data-${Math.abs(hash).toString(36).slice(0, 5)}`;
};

const getUniqueTableName = (baseName: string, existingNames: Set<string>): string => {
    let uniqueName = baseName;
    let counter = 1;
    while (existingNames.has(uniqueName)) {
        uniqueName = `${baseName}_${counter}`;
        counter += 1;
    }
    return uniqueName;
};

export const DataLoadingChat: React.FC = () => {

    const dispatch = useDispatch<AppDispatch>();
    const inputBoxRef = useRef<(() => void) | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const cleanInProgress = useSelector((state: DataFormulatorState) => state.cleanInProgress);
    const existingTables = useSelector((state: DataFormulatorState) => state.tables);
    const dataCleanBlocks = useSelector((state: DataFormulatorState) => state.dataCleanBlocks);
    const focusedDataCleanBlockId = useSelector((state: DataFormulatorState) => state.focusedDataCleanBlockId);

    const [streamingContent, setStreamingContent] = useState('');

    const existingNames = new Set(existingTables.map(t => t.id));

    let existOutputBlocks = dataCleanBlocks.length > 0;

    let dataCleanBlocksThread = createOrderedThreadBlocks(dataCleanBlocks);
    let threadsComponent = dataCleanBlocksThread.map((thread, i) => {
        return <SingleDataCleanThreadView key={`data-clean-thread-${i}`} thread={thread} sx={{
            backgroundColor: 'white', 
            borderRadius: 2,
            padding: 1,
            flex:  'none',
            display: 'flex',
            flexDirection: 'column',
            height: 'fit-content',
            transition: 'all 0.3s ease',
        }} />
    })

    // Get the selected CSV data from Redux state
    const selectedTable = (() => {
        if (focusedDataCleanBlockId) {
            let block = dataCleanBlocks.find(block => block.id === focusedDataCleanBlockId.blockId);
            if (block) {
                return block.items?.[focusedDataCleanBlockId.itemId];
            }
        }
        return undefined;
    })();

    const handleUpload = () => {
        if (!selectedTable) return;

        const suggestedName = selectedTable.name || generateDefaultName(selectedTable.content.value.slice(0, 96));
        
        console.log(selectedTable);

        const base = suggestedName.trim();
        const unique = getUniqueTableName(base, existingNames);
        const table = createTableFromText(unique, selectedTable.content.value, selectedTable.context);
        if (table) {
            dispatch(dfActions.loadTable(table));
            dispatch(fetchFieldSemanticType(table));
        }
    };

    if (!existOutputBlocks && !streamingContent) {
        return <div className="w-[calc(100%-32px)] rounded-lg px-4">
            <DataLoadingInputBox maxLines={24} onStreamingContentUpdate={setStreamingContent} abortControllerRef={abortControllerRef} />
        </div>
    }

    const thinkingBanner = (
        <div className="py-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            <span className="text-xs text-muted-foreground">
                Extracting data...
            </span>
        </div>
    );

    
    let chatCard = (
        <div className={cn(
            "min-h-[400px] flex flex-row rounded-lg",
            (existOutputBlocks || streamingContent) ? "w-[960px]" : "w-[640px]"
        )}>
            
            {/* Left: Chat panel */}
            <div className="w-60 flex flex-col p-2 relative">
                <div className="flex-1 flex flex-col min-h-[480px] overflow-y-auto overflow-x-hidden">
                    {threadsComponent}
                </div>
                <DataLoadingInputBox ref={inputBoxRef} maxLines={4} onStreamingContentUpdate={setStreamingContent} abortControllerRef={abortControllerRef} />
            </div>

            <Separator orientation="vertical" className="mx-4 h-auto" />

            {streamingContent && (
                <div className="flex-[1.4] min-w-[480px] max-w-[640px] flex flex-col p-2">
                    {thinkingBanner}
                    <p className="mt-8 text-xs text-muted-foreground whitespace-pre-wrap overflow-clip max-h-[600px] overflow-y-auto">
                        {streamingContent.trim()}
                    </p>
                </div>
            )}

            {/* Right: Data preview panel */}
            {(existOutputBlocks && !streamingContent) && (
                <div className="flex-[1.4] min-w-[480px] flex flex-col p-2">
                    
                    <p className="text-sm mb-2 font-medium text-foreground flex items-center gap-1">
                        {selectedTable && (
                            <span className="text-xs text-muted-foreground">
                                {selectedTable?.name}
                            </span>
                        )}
                    </p>
                    
                    <div className="flex flex-col flex-1 gap-2 overflow-hidden">
                        {selectedTable ? (
                            <DataPreviewBox />
                        ) : (
                            <p className="text-xs text-muted-foreground text-center mt-8">
                                No data available
                            </p>
                        )}

                        {/* Bottom submit bar */}
                        <div className="mt-auto pt-2 flex flex-row items-center gap-2">
                            <Button
                                variant="default"
                                onClick={() => {
                                    if (inputBoxRef.current) {
                                        inputBoxRef.current();
                                    }
                                }}
                                disabled={!selectedTable || selectedTable.content.type !== 'image_url' || cleanInProgress}
                                size="sm"
                            >
                                Extract data from image
                            </Button>
                            <Button
                                variant="default"
                                className="ml-auto"
                                onClick={handleUpload}
                                disabled={!selectedTable || selectedTable.content.type !== 'csv'}
                                size="sm"
                            >
                                Load table
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return chatCard;
};

export interface DataLoadingChatDialogProps {
    buttonElement?: any;
    disabled?: boolean;
    onOpen?: () => void;
    // Controlled mode props
    open?: boolean;
    onClose?: () => void;
}

export const DataLoadingChatDialog: React.FC<DataLoadingChatDialogProps> = ({ 
    buttonElement, 
    disabled = false, 
    onOpen,
    open: controlledOpen,
    onClose,
}) => {
    const [internalOpen, setInternalOpen] = useState<boolean>(false);
    const dispatch = useDispatch<AppDispatch>();
    const dataCleanBlocks = useSelector((state: DataFormulatorState) => state.dataCleanBlocks);

    // Support both controlled and uncontrolled modes
    const isControlled = controlledOpen !== undefined;
    const dialogOpen = isControlled ? controlledOpen : internalOpen;
    const setDialogOpen = isControlled 
        ? (open: boolean) => { if (!open && onClose) onClose(); }
        : setInternalOpen;

    return (
        <>
            {buttonElement && (
                <div 
                    className="cursor-pointer"
                    onClick={() => {
                        if (!disabled) {
                            setDialogOpen(true);
                            onOpen?.();
                        }
                    }}
                >
                    {buttonElement}
                </div>
            )}
            <Dialog 
                open={dialogOpen}
                onOpenChange={(open) => setDialogOpen(open)}
            >
                <DialogContent className="max-w-250 max-h-[85vh] p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b border-border flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle className="text-base font-semibold flex items-center gap-2">
                                <ImagePlus className="h-4 w-4" />
                                Extract Data
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Extract structured data from images and documents
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {dataCleanBlocks.length > 0 && (
                                <Button 
                                    variant="ghost" 
                                    size="icon-sm"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => dispatch(dfActions.resetDataCleanBlocks())}
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                    <div className="p-4 overflow-auto max-h-[calc(85vh-80px)]">
                        <DataLoadingChat />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};


