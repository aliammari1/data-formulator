// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { FC, useEffect, useState } from 'react';
import '../scss/App.scss';

import { useDispatch, useSelector } from "react-redux";
import {
    DataFormulatorState,
    dfActions,
    dfSelectors,
    fetchAvailableModels,
    getSessionId,
} from './dfSlice'

import _ from 'lodash';

import { Box } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

import { DataFormulatorFC } from '../views/DataFormulator';

import {
    createBrowserRouter,
    RouterProvider,
} from "react-router-dom";
import { About } from '../views/About';
import { MessageSnackbar } from '../views/MessageSnackbar';
import { DictTable } from '../components/ComponentType';
import { AppDispatch } from './store';
import dfLogo from '../assets/df-logo.png';
import { ModelSelectionButton } from '../views/ModelSelectionDialog';
import { TableCopyDialogV2 } from '../views/TableSelectionView';
import { TableUploadDialog } from '../views/TableSelectionView';
import { DBTableSelectionDialog, handleDBDownload } from '../views/DBTableManager';
import { getUrls } from './utils';
import { DataLoadingChatDialog } from '../views/DataLoadingChat';
import { AgentRulesDialog } from '../views/AgentRulesDialog';

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Lucide Icons
import {
    Power,
    Settings,
    ChevronDown,
    Database,
    ClipboardPaste,
    Upload,
    Download,
    FileText,
    Github,
    Youtube,
    Sparkles,
    FileUp,
    MessageSquare,
    Zap,
} from 'lucide-react';

// Discord Icon Component
const DiscordIcon: FC<{ className?: string }> = ({ className }) => (
    <svg 
        className={className} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        width="16" 
        height="16"
    >
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
);

declare module '@mui/material/styles' {
    interface Palette {
        derived: Palette['primary'];
        custom: Palette['primary'];
    }
    interface PaletteOptions {
        derived: PaletteOptions['primary'];
        custom: PaletteOptions['primary'];
    }
}

export const ImportStateButton: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const dispatch = useDispatch();
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const files = event.target.files;
        if (files) {
            for (let file of files) {
                file.text().then((text) => {
                    try {
                        let savedState = JSON.parse(text);
                        dispatch(dfActions.loadState(savedState));
                    } catch (error) {
                        console.error('Failed to parse state file:', error);
                    }
                });
            }
        }
        if (inputRef.current) {
            inputRef.current.value = '';
        }
        onClose?.();
    };

    return (
        <div 
            className="flex items-center gap-2 w-full cursor-pointer"
            onClick={() => inputRef.current?.click()}
        >
            <FileUp className="h-4 w-4" />
            <span>Import Session</span>
            <input
                type="file"
                accept=".json, .dfstate"
                className="hidden"
                ref={inputRef}
                onChange={handleFileUpload}
            />
        </div>
    );
}

export const ExportStateButton: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    const sessionId = useSelector((state: DataFormulatorState) => state.sessionId);
    const tables = useSelector((state: DataFormulatorState) => state.tables);
    const fullStateJson = useSelector((state: DataFormulatorState) => {
        const excludedFields = new Set([
            'models',
            'selectedModelId',
            'testedModels',
            'dataLoaderConnectParams',
            'sessionId',
            'agentRules',
            'serverConfig',
        ]);
        
        const stateToSerialize: any = {};
        for (const [key, value] of Object.entries(state)) {
            if (!excludedFields.has(key)) {
                stateToSerialize[key] = value;
            }
        }
        
        return JSON.stringify(stateToSerialize);
    });

    return (
        <div 
            className="flex items-center gap-2 w-full cursor-pointer"
            onClick={() => {
                function download(content: string, fileName: string, contentType: string) {
                    let a = document.createElement("a");
                    let file = new Blob([content], { type: contentType });
                    a.href = URL.createObjectURL(file);
                    a.download = fileName;
                    a.click();
                }
                let firstTableName = tables.length > 0 ? tables[0].id: '';
                download(fullStateJson, `df_state_${firstTableName}_${sessionId?.slice(0, 4)}.json`, 'text/plain');
                onClose?.();
            }}
        >
            <Download className="h-4 w-4" />
            <span>Export Session</span>
        </div>
    );
}


export const toolName = "Data Formulator"

export interface AppFCProps {
}

// Modern Table Menu Component
const TableMenu: React.FC = () => {
    const [openDialog, setOpenDialog] = useState<'database' | 'extract' | 'paste' | 'upload' | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleOpenDialog = (dialog: 'database' | 'extract' | 'paste' | 'upload') => {
        if (dialog === 'upload') {
            fileInputRef.current?.click();
        } else {
            setOpenDialog(dialog);
        }
    };
    
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 h-8 text-foreground/80 hover:text-foreground">
                        <Sparkles className="h-4 w-4" />
                        Data
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        Add data to workspace
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleOpenDialog('database')}>
                        <Database className="h-4 w-4" />
                        <span>Connect to Database</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenDialog('extract')}>
                        <MessageSquare className="h-4 w-4" />
                        <span>Extract from Image/Text</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">AI</Badge>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleOpenDialog('paste')}>
                        <ClipboardPaste className="h-4 w-4" />
                        <span>Paste Data</span>
                        <span className="ml-auto text-xs text-muted-foreground">CSV/TSV</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenDialog('upload')}>
                        <Upload className="h-4 w-4" />
                        <span>Upload File</span>
                        <span className="ml-auto text-xs text-muted-foreground">CSV/JSON</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            
            <DBTableSelectionDialog 
                open={openDialog === 'database'} 
                onClose={() => setOpenDialog(null)} 
            />
            <DataLoadingChatDialog 
                open={openDialog === 'extract'} 
                onClose={() => setOpenDialog(null)} 
            />
            <TableCopyDialogV2 
                open={openDialog === 'paste'} 
                onClose={() => setOpenDialog(null)} 
            />
            <TableUploadDialog 
                fileInputRef={fileInputRef}
            />
        </>
    );
};

// Modern Session Menu Component
const SessionMenu: React.FC = () => {
    const sessionId = useSelector((state: DataFormulatorState) => state.sessionId);
    const tables = useSelector((state: DataFormulatorState) => state.tables);
    const dispatch = useDispatch();
    const [open, setOpen] = useState(false);
    
    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 h-8 text-foreground/80 hover:text-foreground">
                    <FileText className="h-4 w-4" />
                    Session
                    <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Session management
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    <ExportStateButton onClose={() => setOpen(false)} />
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <ImportStateButton onClose={() => setOpen(false)} />
                </DropdownMenuItem>
                {sessionId && tables.some(t => t.virtual) && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                            Database file
                        </DropdownMenuLabel>
                        <DropdownMenuItem 
                            onClick={() => handleDBDownload(sessionId ?? '')}
                            disabled={!sessionId || !tables.some(t => t.virtual)}
                        >
                            <Download className="h-4 w-4" />
                            <span>Download Database</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Upload className="h-4 w-4" />
                                <span>Import Database</span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept=".db" 
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        try {
                                            const response = await fetch(getUrls().UPLOAD_DB_FILE, { method: 'POST', body: formData });
                                            const data = await response.json();
                                            if (data.status === 'success') {
                                                dispatch(dfActions.addMessages({ timestamp: Date.now(), component: "DB Manager", type: "success", value: "Database imported successfully" }));
                                            } else {
                                                dispatch(dfActions.addMessages({ timestamp: Date.now(), component: "DB Manager", type: "error", value: data.message || 'Import failed' }));
                                            }
                                        } catch (error) {
                                            dispatch(dfActions.addMessages({ timestamp: Date.now(), component: "DB Manager", type: "error", value: 'Import failed' }));
                                        }
                                        e.target.value = '';
                                        setOpen(false);
                                    }} 
                                />
                            </label>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

// Modern Reset Dialog Component
const ResetDialog: React.FC = () => {
    const [open, setOpen] = useState(false);
    const dispatch = useDispatch();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 h-8 text-foreground/80 hover:text-destructive">
                    <Power className="h-4 w-4" />
                    Reset
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Power className="h-5 w-5 text-destructive" />
                        Reset Session?
                    </DialogTitle>
                    <DialogDescription>
                        All unexported content (charts, derived data, concepts) will be permanently lost.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="destructive"
                        onClick={() => { 
                            dispatch(dfActions.resetState()); 
                            setOpen(false);
                            setTimeout(() => {
                                window.location.reload();
                            }, 250);
                        }}
                    >
                        <Power className="h-4 w-4 mr-2" />
                        Reset Session
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Modern Settings Dialog Component
const ConfigDialog: React.FC = () => {
    const [open, setOpen] = useState(false);
    const dispatch = useDispatch();
    const config = useSelector((state: DataFormulatorState) => state.config);

    const [formulateTimeoutSeconds, setFormulateTimeoutSeconds] = useState(config.formulateTimeoutSeconds);
    const [maxRepairAttempts, setMaxRepairAttempts] = useState(config.maxRepairAttempts);
    const [defaultChartWidth, setDefaultChartWidth] = useState(config.defaultChartWidth);
    const [defaultChartHeight, setDefaultChartHeight] = useState(config.defaultChartHeight);

    const hasChanges = formulateTimeoutSeconds !== config.formulateTimeoutSeconds || 
                      maxRepairAttempts !== config.maxRepairAttempts ||
                      defaultChartWidth !== config.defaultChartWidth ||
                      defaultChartHeight !== config.defaultChartHeight;

    const isValid = !isNaN(maxRepairAttempts) && maxRepairAttempts > 0 && maxRepairAttempts <= 5 
        && !isNaN(formulateTimeoutSeconds) && formulateTimeoutSeconds > 0 && formulateTimeoutSeconds <= 3600
        && !isNaN(defaultChartWidth) && defaultChartWidth >= 100 && defaultChartWidth <= 1000
        && !isNaN(defaultChartHeight) && defaultChartHeight >= 100 && defaultChartHeight <= 1000;

    useEffect(() => {
        if (open) {
            setFormulateTimeoutSeconds(config.formulateTimeoutSeconds);
            setMaxRepairAttempts(config.maxRepairAttempts);
            setDefaultChartWidth(config.defaultChartWidth);
            setDefaultChartHeight(config.defaultChartHeight);
        }
    }, [open, config]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 h-8 text-foreground/80 hover:text-foreground">
                    <Settings className="h-4 w-4" />
                    Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Settings
                    </DialogTitle>
                    <DialogDescription>
                        Configure chart and processing options
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                    {/* Frontend Settings */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">Chart Defaults</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="chartWidth" className="text-sm">Width (px)</Label>
                                <Input
                                    id="chartWidth"
                                    type="number"
                                    min={100}
                                    max={1000}
                                    value={defaultChartWidth}
                                    onChange={(e) => setDefaultChartWidth(parseInt(e.target.value))}
                                    className={cn(
                                        (defaultChartWidth < 100 || defaultChartWidth > 1000) && "border-destructive"
                                    )}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="chartHeight" className="text-sm">Height (px)</Label>
                                <Input
                                    id="chartHeight"
                                    type="number"
                                    min={100}
                                    max={1000}
                                    value={defaultChartHeight}
                                    onChange={(e) => setDefaultChartHeight(parseInt(e.target.value))}
                                    className={cn(
                                        (defaultChartHeight < 100 || defaultChartHeight > 1000) && "border-destructive"
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Backend Settings */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">Processing</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="timeout" className="text-sm">Formulate Timeout (seconds)</Label>
                                <Input
                                    id="timeout"
                                    type="number"
                                    min={1}
                                    max={3600}
                                    value={formulateTimeoutSeconds}
                                    onChange={(e) => setFormulateTimeoutSeconds(parseInt(e.target.value))}
                                    className={cn(
                                        (formulateTimeoutSeconds <= 0 || formulateTimeoutSeconds > 3600) && "border-destructive"
                                    )}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Maximum time for formulation before timeout
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="repair" className="text-sm">Max Repair Attempts</Label>
                                <Input
                                    id="repair"
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={maxRepairAttempts}
                                    onChange={(e) => setMaxRepairAttempts(parseInt(e.target.value))}
                                    className={cn(
                                        (maxRepairAttempts <= 0 || maxRepairAttempts > 5) && "border-destructive"
                                    )}
                                />
                                <p className="text-xs text-muted-foreground">
                                    How many times to retry if code fails (1-5)
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button 
                        variant="ghost" 
                        onClick={() => {
                            setFormulateTimeoutSeconds(30);
                            setMaxRepairAttempts(1);
                            setDefaultChartWidth(300);
                            setDefaultChartHeight(300);
                        }}
                        className="mr-auto"
                    >
                        Reset to Default
                    </Button>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={() => {
                            dispatch(dfActions.setConfig({formulateTimeoutSeconds, maxRepairAttempts, defaultChartWidth, defaultChartHeight}));
                            setOpen(false);
                        }}
                        disabled={!hasChanges || !isValid}
                    >
                        Apply Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );  
}

export const AppFC: FC<AppFCProps> = function AppFC(appProps) {
    const dispatch = useDispatch<AppDispatch>();
    const viewMode = useSelector((state: DataFormulatorState) => state.viewMode);
    const generatedReports = useSelector((state: DataFormulatorState) => state.generatedReports);
    const focusedTableId = useSelector((state: DataFormulatorState) => state.focusedTableId);
    const serverConfig = useSelector((state: DataFormulatorState) => state.serverConfig);

    useEffect(() => {
        fetch(getUrls().APP_CONFIG)
            .then(response => response.json())
            .then(data => {
                dispatch(dfActions.setServerConfig(data));
            });
    }, []);

    useEffect(() => {
        document.title = toolName;
        dispatch(fetchAvailableModels());
        dispatch(getSessionId());
    }, []);

    let theme = createTheme({
        typography: {
            fontFamily: [
                "Inter",
                "system-ui",
                "-apple-system",
                "sans-serif"
            ].join(",")
        },
        palette: {
            primary: {
                main: '#0078d4'
            },
            secondary: {
                main: '#8764b8'
            },
            derived: {
                main: '#ffb900',
            },
            custom: {
                main: '#d83b01',
            },
            warning: {
                main: '#a4262c',
            },
        },
    });

    const isAboutPage = (window.location.pathname === '/about' 
            || (window.location.pathname === '/' && serverConfig.PROJECT_FRONT_PAGE));

    // Clean Linear-Style Header
    const appHeader = (
        <header className="df-header sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
            <div className="flex h-14 items-center px-4 gap-4">
                {/* Logo and Brand - Clean Style */}
                <a href="/" className="flex items-center gap-3 font-medium group">
                    <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                        <img src={dfLogo} alt="Data Formulator" className="h-5 w-5 invert" />
                    </div>
                    <span className="text-sm font-semibold text-foreground hidden sm:inline-block">
                        {toolName}
                    </span>
                </a>

                {/* Navigation Tabs - Clean Pill Style */}
                <nav className="flex items-center">
                    <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                        <a
                            href="/about"
                            className={cn(
                                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                                isAboutPage 
                                    ? "bg-background text-foreground shadow-sm" 
                                    : "hover:text-foreground"
                            )}
                        >
                            About
                        </a>
                        <a
                            href="/app"
                            className={cn(
                                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                                !isAboutPage 
                                    ? "bg-background text-foreground shadow-sm" 
                                    : "hover:text-foreground"
                            )}
                        >
                            App
                        </a>
                    </div>
                </nav>

                {/* Spacer */}
                <div className="flex-1" />

                {/* App Controls (only when not on about page) */}
                {!isAboutPage && (
                    <div className="flex items-center gap-2">
                        {/* View Mode Toggle */}
                        {focusedTableId !== undefined && (
                            <>
                                <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                                    <button
                                        onClick={() => dispatch(dfActions.setViewMode('editor'))}
                                        className={cn(
                                            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                            viewMode === 'editor' 
                                                ? "bg-background text-foreground shadow-sm" 
                                                : "hover:text-foreground"
                                        )}
                                    >
                                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                                        Explore
                                    </button>
                                    <button
                                        onClick={() => dispatch(dfActions.setViewMode('report'))}
                                        className={cn(
                                            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                            viewMode === 'report' 
                                                ? "bg-background text-foreground shadow-sm" 
                                                : "hover:text-foreground"
                                        )}
                                    >
                                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                                        Reports
                                        {generatedReports.length > 0 && (
                                            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] font-semibold">
                                                {generatedReports.length}
                                            </Badge>
                                        )}
                                    </button>
                                </div>
                                
                                <Separator orientation="vertical" className="h-6 mx-1" />
                                
                                <ConfigDialog />
                                <AgentRulesDialog />
                                
                                <Separator orientation="vertical" className="h-6 mx-1" />
                            </>
                        )}

                        <ModelSelectionButton />
                        
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        
                        <TableMenu />
                        <SessionMenu />
                        
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        
                        <ResetDialog />
                    </div>
                )}

                {/* Social Links */}
                <div className="flex items-center gap-1">
                    {isAboutPage && (
                        <>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon-sm" className="rounded-full hover:bg-primary/10" asChild>
                                            <a href="https://youtu.be/3ndlwt0Wi3c" target="_blank" rel="noopener noreferrer">
                                                <Youtube className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Watch Video</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon-sm" className="rounded-full hover:bg-primary/10" asChild>
                                            <a href="https://pypi.org/project/data-formulator/" target="_blank" rel="noopener noreferrer">
                                                <img src="/pip-logo.svg" className="h-4 w-4" alt="pip" />
                                            </a>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Install via pip</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon-sm" asChild>
                                            <a href="https://discord.gg/mYCZMQKYZb" target="_blank" rel="noopener noreferrer">
                                                <DiscordIcon className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Join Discord</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </>
                    )}
                    
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon-sm" asChild>
                                    <a href="https://github.com/microsoft/data-formulator" target="_blank" rel="noopener noreferrer">
                                        <Github className="h-4 w-4" />
                                    </a>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>View on GitHub</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </header>
    );

    let router = createBrowserRouter([
        {
            path: "/about",
            element: <About />,
        }, {
            path: "/",
            element: serverConfig.PROJECT_FRONT_PAGE ? <About /> : <DataFormulatorFC />,
        }, {
            path: "*",
            element: <DataFormulatorFC />,
            errorElement: (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-muted-foreground">
                        <p>An error has occurred.</p>
                        <a href="/" className="text-primary hover:underline">Refresh the session</a>
                    </div>
                </div>
            )
        }
    ]);

    return (
        <ThemeProvider theme={theme}>
            <div className="fixed inset-0 flex flex-col bg-background">
                <div className="min-w-[1000px] min-h-[800px] flex flex-col h-full w-full overflow-hidden">
                    {appHeader}
                    <main className="flex-1 overflow-hidden">
                        <RouterProvider router={router} />
                    </main>
                    <MessageSnackbar />
                </div>
            </div>
        </ThemeProvider>
    );
}
