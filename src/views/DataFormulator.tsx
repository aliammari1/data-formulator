import React, { useEffect, useState } from 'react';
import '../scss/App.scss';

import { useDispatch, useSelector } from "react-redux";
import { 
    DataFormulatorState,
    dfActions,
    dfSelectors,
    ModelConfig,
} from '../app/dfSlice'

import _ from 'lodash';

import { Allotment } from "allotment";
import "allotment/dist/style.css";

import {
    Typography,
    Box,
    Tooltip,
    Button as MuiButton,
    Divider,
    useTheme,
    alpha,
} from '@mui/material';
import {
    FolderOpen as FolderOpenIcon,
    ContentPaste as ContentPasteIcon,
    Category as CategoryIcon,
    CloudQueue as CloudQueueIcon,
    AutoFixNormal as AutoFixNormalIcon,
} from '@mui/icons-material';

import { FreeDataViewFC } from './DataView';
import { VisualizationViewFC } from './VisualizationView';

import { ConceptShelf } from './ConceptShelf';
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TableCopyDialogV2, DatasetSelectionDialog } from './TableSelectionView';
import { TableUploadDialog } from './TableSelectionView';
import { toolName } from '../app/App';
import { DataThread } from './DataThread';

import dfLogo from '../assets/df-logo.png';
import exampleImageTable from "../assets/example-image-table.png";
import { ModelSelectionButton } from './ModelSelectionDialog';
import { DBTableSelectionDialog } from './DBTableManager';
import { getUrls } from '../app/utils';
import { DataLoadingChatDialog } from './DataLoadingChat';
import { ReportView } from './ReportView';
import { ExampleSession, exampleSessions, ExampleSessionCard } from './ExampleSessions';

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Lucide Icons
import { Database, FileImage, Clipboard, Upload, Sparkles, ArrowRight, ExternalLink, Play, Zap, BarChart3, LineChart, PieChart, TrendingUp, Layers, Wand2, Bot, ChevronRight } from 'lucide-react';

export const DataFormulatorFC = ({ }) => {

    const tables = useSelector((state: DataFormulatorState) => state.tables);
    const models = useSelector((state: DataFormulatorState) => state.models);
    const selectedModelId = useSelector((state: DataFormulatorState) => state.selectedModelId);
    const viewMode = useSelector((state: DataFormulatorState) => state.viewMode);
    const theme = useTheme();

    const dispatch = useDispatch();

    const handleLoadExampleSession = (session: ExampleSession) => {
        dispatch(dfActions.addMessages({
            timestamp: Date.now(),
            type: 'info',
            component: 'data formulator',
            value: `Loading example session: ${session.title}`,
        }));
        
        // Load the complete state from the JSON file
        fetch(session.dataFile)
            .then(res => res.json())
            .then(savedState => {
                // Use loadState to restore the complete session state
                dispatch(dfActions.loadState(savedState));
                
                dispatch(dfActions.addMessages({
                    timestamp: Date.now(),
                    type: 'success',
                    component: 'data formulator',
                    value: `Successfully loaded ${session.title}`,
                }));
            })
            .catch(error => {
                console.error('Error loading session:', error);
                dispatch(dfActions.addMessages({
                    timestamp: Date.now(),
                    type: 'error',
                    component: 'data formulator',
                    value: `Failed to load ${session.title}: ${error.message}`,
                }));
            });
    };

    useEffect(() => {
        document.title = toolName;
        
        // Preload imported images (public images are preloaded in index.html)
        const imagesToPreload = [
            { src: dfLogo, type: 'image/png' },
            { src: exampleImageTable, type: 'image/png' },
        ];
        
        const preloadLinks: HTMLLinkElement[] = [];
        imagesToPreload.forEach(({ src, type }) => {
            // Use link preload for better priority
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = src;
            link.type = type;
            document.head.appendChild(link);
            preloadLinks.push(link);
        });
        
        // Cleanup function to remove preload links when component unmounts
        return () => {
            preloadLinks.forEach(link => {
                if (link.parentNode) {
                    link.parentNode.removeChild(link);
                }
            });
        };
    }, []);

    useEffect(() => {
        const findWorkingModel = async () => {
            let selectedModel = models.find(m => m.id == selectedModelId);
            let otherModels = models.filter(m => m.id != selectedModelId);

            let modelsToTest = [selectedModel, ...otherModels].filter(m => m != undefined);

            let testModel = async (model: ModelConfig) => {
                const message = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ model }),
                };
                try {
                    const response = await fetch(getUrls().TEST_MODEL, {...message });
                    const data = await response.json();
                    const status = data["status"] || 'error';
                    return {model, status, message: data["message"] || ""};
                } catch (error) {
                    return {model, status: 'error', message: (error as Error).message || 'Failed to test model'};
                }
            }

            // Then test unassigned models sequentially until one works
            for (let model of modelsToTest) {
                let testResult = await testModel(model);
                dispatch(dfActions.updateModelStatus({
                    id: model.id, 
                    status: testResult.status, 
                    message: testResult.message
                }));
                if (testResult.status == 'ok') {
                    dispatch(dfActions.selectModel(model.id));
                    return;
                };
            }
        };

        if (models.length > 0) {
            findWorkingModel();
        }
    }, []);

    const visPaneMain = (
        <Box sx={{ width: "100%", overflow: "hidden", display: "flex", flexDirection: "row" }}>
            <VisualizationViewFC />
        </Box>);

    const visPane = (
        <Box sx={{width: '100%', height: '100%', 
            "& .split-view-view:first-of-type": {
                display: 'flex',
                overflow: 'hidden',
        }}}>
            <Allotment vertical>
                <Allotment.Pane minSize={200} >
                {visPaneMain}
                </Allotment.Pane>
                <Allotment.Pane minSize={120} preferredSize={200}>
                    <Box className="table-box">
                        <FreeDataViewFC />
                    </Box>
                </Allotment.Pane>
            </Allotment>
        </Box>);

    let borderBoxStyle = {
        border: '1px solid rgba(99, 102, 241, 0.1)', 
        borderRadius: '20px', 
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.95) 100%)',
        boxShadow: '0 4px 24px rgba(99, 102, 241, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
    }

    const fixedSplitPane = ( 
        <Box sx={{display: 'flex', flexDirection: 'row', height: '100%', background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)'}}>
            <Box sx={{
                ...borderBoxStyle,
                    margin: '8px 6px 8px 12px',
                    display: 'flex', height: 'calc(100% - 16px)', width: 'fit-content', flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)',
                        borderRadius: '20px 20px 0 0',
                    }
                }}>
                {tables.length > 0 ?  <DataThread sx={{
                    minWidth: 220,
                    display: 'flex', 
                    flexDirection: 'column',
                    overflow: 'hidden',
                    alignContent: 'flex-start',
                    height: '100%',
                    padding: '8px 0 0 0',
                }}/>  : ""} 
            </Box>
            <Box sx={{
                ...borderBoxStyle,
                margin: '8px 12px 8px 6px',
                display: 'flex', height: 'calc(100% - 16px)', flex: 1, overflow: 'hidden', flexDirection: 'row',
                position: 'relative',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)',
                    borderRadius: '20px 20px 0 0',
                }
            }}>
                {viewMode === 'editor' ? (
                    <>
                        {visPane}
                        <ConceptShelf />
                    </>
                ) : (
                    <ReportView />
                )}
            </Box>
            
        </Box>
    );

    let footer = (
        <footer className="py-6 px-8 bg-muted/30 border-t border-border">
            <div className="flex items-center justify-center gap-6 text-sm">
                <a 
                    href="https://www.microsoft.com/en-us/privacy/privacystatement" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                    Privacy & Cookies
                </a>
                <div className="w-1 h-1 rounded-full bg-border" />
                <a 
                    href="https://www.microsoft.com/en-us/legal/intellectualproperty/copyright" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                    Terms of Use
                </a>
                <div className="w-1 h-1 rounded-full bg-border" />
                <a 
                    href="https://github.com/microsoft/data-formulator/issues" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                    Contact Us
                </a>
                <div className="w-1 h-1 rounded-full bg-border" />
                <span className="text-muted-foreground/60 text-xs">
                    © {new Date().getFullYear()} Microsoft
                </span>
            </div>
        </footer>
    );

    let dataUploadRequestBox = (
        <div className="flex flex-col h-full w-full overflow-auto bg-background">
            {/* Subtle Background Pattern */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="decorative-grid opacity-30" />
            </div>
            
            <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
                {/* Clean Hero Section - Linear Style */}
                <div className="text-center mb-14 max-w-4xl animate-fade-in">
                    {/* Simple Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border mb-10">
                        <Sparkles className="h-4 w-4 text-foreground/60" />
                        <span className="text-sm font-medium text-foreground/80">AI-Powered Data Visualization</span>
                    </div>
                    
                    {/* Clean Title */}
                    <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-6 text-foreground">
                        {toolName}
                    </h1>
                    
                    {/* Subtitle */}
                    <p className="text-xl md:text-2xl text-muted-foreground mb-3 font-normal">
                        Transform your data into stunning visualizations
                    </p>
                    <p className="text-base text-muted-foreground/70 mb-10 max-w-xl mx-auto">
                        Powered by AI. No coding required. Just describe what you want to see.
                    </p>
                </div>

                {/* Clean Cards - Linear Style */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16 max-w-5xl w-full animate-slide-up">
                    <DataLoadingChatDialog buttonElement={
                        <Card className="group cursor-pointer bg-card hover:bg-muted/50 border border-border hover:border-foreground/20 transition-all duration-200 h-full">
                            <CardHeader className="pb-3">
                                <div className="w-10 h-10 rounded-lg bg-foreground flex items-center justify-center mb-4">
                                    <FileImage className="h-5 w-5 text-background" />
                                </div>
                                <CardTitle className="text-base font-semibold">Extract Data</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <CardDescription className="text-sm leading-relaxed">
                                    Use AI to extract structured data from images and documents
                                </CardDescription>
                            </CardContent>
                        </Card>
                    }/>
                    
                    <DBTableSelectionDialog buttonElement={
                        <Card className="group cursor-pointer bg-card hover:bg-muted/50 border border-border hover:border-foreground/20 transition-all duration-200 h-full">
                            <CardHeader className="pb-3">
                                <div className="w-10 h-10 rounded-lg bg-foreground flex items-center justify-center mb-4">
                                    <Database className="h-5 w-5 text-background" />
                                </div>
                                <CardTitle className="text-base font-semibold">Connect Database</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <CardDescription className="text-sm leading-relaxed">
                                    PostgreSQL, MySQL, SQLite and more databases
                                </CardDescription>
                            </CardContent>
                        </Card>
                    }/>
                    
                    <TableCopyDialogV2 buttonElement={
                        <Card className="group cursor-pointer bg-card hover:bg-muted/50 border border-border hover:border-foreground/20 transition-all duration-200 h-full">
                            <CardHeader className="pb-3">
                                <div className="w-10 h-10 rounded-lg bg-foreground flex items-center justify-center mb-4">
                                    <Clipboard className="h-5 w-5 text-background" />
                                </div>
                                <CardTitle className="text-base font-semibold">Paste Data</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <CardDescription className="text-sm leading-relaxed">
                                    Paste from clipboard in CSV or TSV format
                                </CardDescription>
                            </CardContent>
                        </Card>
                    } disabled={false}/>
                    
                    <TableUploadDialog buttonElement={
                        <Card className="group cursor-pointer bg-card hover:bg-muted/50 border border-border hover:border-foreground/20 transition-all duration-200 h-full">
                            <CardHeader className="pb-3">
                                <div className="w-10 h-10 rounded-lg bg-foreground flex items-center justify-center mb-4">
                                    <Upload className="h-5 w-5 text-background" />
                                </div>
                                <CardTitle className="text-base font-semibold">Upload File</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <CardDescription className="text-sm leading-relaxed">
                                    CSV, TSV, JSON and Excel files
                                </CardDescription>
                            </CardContent>
                        </Card>
                    } disabled={false}/>
                </div>
                
                {/* Demo Sessions Section */}
                <div className="w-full max-w-5xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="flex-1 h-px bg-border" />
                        <div className="flex items-center gap-2 px-4 py-2 text-muted-foreground">
                            <Play className="h-4 w-4" />
                            <span className="text-sm font-medium">Demo Sessions</span>
                        </div>
                        <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {exampleSessions.map((session) => (
                            <ExampleSessionCard
                                key={session.id}
                                session={session}
                                theme={theme}
                                onClick={() => handleLoadExampleSession(session)}
                            />
                        ))}
                    </div>
                </div>
            </div>
            {footer}
        </div>
    );
    
    return (
        <Box sx={{ display: 'block', width: "100%", height: 'calc(100% - 54px)', position: 'relative' }}>
            <DndProvider backend={HTML5Backend}>
                {tables.length > 0 ? fixedSplitPane : dataUploadRequestBox}
                {selectedModelId == undefined && (
                    <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col z-[1000]">
                        <div className="flex-1 flex flex-col items-center justify-center text-center pb-20">
                            <img src={dfLogo} alt="Data Formulator" className="w-48 h-48 mb-6" />
                            <h1 className="text-4xl font-light tracking-wider text-foreground mb-2">
                                {toolName}
                            </h1>
                            <div className="mt-8 flex flex-col items-center gap-4">
                                <p className="text-2xl text-foreground">
                                    First, let's <ModelSelectionButton />
                                </p>
                                <p className="text-sm text-muted-foreground max-w-lg px-4">
                                    💡 Models with strong code generation capabilities (e.g., GPT-5, Claude Sonnet 4.5) provide the best experience with Data Formulator.
                                </p>
                            </div>
                        </div>
                        {footer}
                    </div>
                )}
            </DndProvider>
        </Box>);
}