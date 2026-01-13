// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';

import { Box, Divider, Tooltip, CircularProgress, Typography } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CloseIcon from '@mui/icons-material/Close';

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
        return <Box sx={{ width: 'calc(100% - 32px)', borderRadius: 2, px: 2 }}>
            <DataLoadingInputBox maxLines={24} onStreamingContentUpdate={setStreamingContent} abortControllerRef={abortControllerRef} />
        </Box>
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
        <Box sx={{ width: (existOutputBlocks || streamingContent) ? '960px' : '640px', minHeight: 400,
                display: 'flex', flexDirection: 'row', borderRadius: 2 }}>
            
            {/* Left: Chat panel */}
            <Box
                sx={{
                    width: 240,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 1,
                    position: 'relative'
                }}
            >
                <Box sx={{ flex: 1,  display: 'flex', flexDirection: 'column', minHeight: '480px', 
                    overflowY: 'auto', overflowX: 'hidden' }}>
                    {threadsComponent}
                </Box>
                <DataLoadingInputBox ref={inputBoxRef} maxLines={4} onStreamingContentUpdate={setStreamingContent} abortControllerRef={abortControllerRef} />
            </Box>

            <Divider orientation="vertical" flexItem sx={{m: 2, color: 'divider'}} />

            {streamingContent && (
                <Box
                    sx={{
                        flex: 1.4,
                        minWidth: 480,
                        maxWidth: 640,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 1
                    }}
                >
                    {thinkingBanner}
                    <Typography variant="body2" color="text.secondary" 
                        sx={{ mt: 4, fontSize: '11px', whiteSpace: 'pre-wrap', overflow: 'clip', maxHeight: '600px', overflowY: 'auto' }}>
                        {streamingContent.trim()}
                    </Typography>
                </Box>
            )}

            {/* Right: Data preview panel */}
            {(existOutputBlocks && !streamingContent) && (
                <Box
                    sx={{
                        flex: 1.4,
                        minWidth: 480,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 1
                    }}
                >
                    
                    <Typography 
                        sx={{ 
                            fontSize: 14, 
                            marginBottom: 1,
                            fontWeight: 500,
                            color: 'text.primary',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5
                        }}
                        gutterBottom
                    >
                        {selectedTable && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {selectedTable?.name}
                            </Typography>
                        )}
                    </Typography>
                    
                    <Box 
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            gap: 1,
                            overflow: 'hidden'
                        }}
                    >
                        {selectedTable ? (
                            <DataPreviewBox />
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4, fontSize: '11px' }}>
                                No data available
                            </Typography>
                        )}

                        {/* Bottom submit bar */}
                        <Box sx={{ mt: 'auto', pt: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, 
                            '& .MuiButton-root': { textTransform: 'none' } }}>
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
                        </Box>
                    </Box>
                </Box>
            )}
        </Box>
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


