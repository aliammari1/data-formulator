// TableManager.tsx
import React, { useState, useEffect, FC } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Trash2, X, BarChart3, ChevronUp, ChevronDown, Table2, RefreshCw, ArrowRight, Search, Bot, Check, Eraser, Loader2 } from 'lucide-react';

import { getUrls } from '../app/utils';
import { CustomReactTable } from './ReactTable';
import { DictTable } from '../components/ComponentType';
import { Type } from '../data/types';
import { useDispatch, useSelector } from 'react-redux';
import { dfActions, dfSelectors, getSessionId } from '../app/dfSlice';
import { DataFormulatorState } from '../app/dfSlice';
import { fetchFieldSemanticType } from '../app/dfSlice';
import { AppDispatch } from '../app/store';
import Editor from 'react-simple-code-editor';
import Markdown from 'markdown-to-jsx';

import Prism from 'prismjs'
import 'prismjs/components/prism-javascript' // Language
import 'prismjs/themes/prism.css'; //Example style, you can use another

export const handleDBDownload = async (sessionId: string) => {
    try {
        const response = await fetch(getUrls().DOWNLOAD_DB_FILE, {
            method: 'GET',
        });
        
        // Check if the response is ok
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to download database file');
        }

        // Get the blob directly from response
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link element
        const link = document.createElement('a');
        link.href = url;
        link.download = `df_${sessionId?.slice(0, 4)}.db`;
        document.body.appendChild(link);    
        
        // Trigger download
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        throw error;
    }
};

interface DBTable {
    name: string;
    columns: {
        name: string;
        type: string;
    }[];
    row_count: number;
    sample_rows: any[];
    view_source: string | null;
}

interface ColumnStatistics {
    column: string;
    type: string;
    statistics: {
        count: number;
        unique_count: number;
        null_count: number;
        min?: number;
        max?: number;
        avg?: number;
    };
}

interface TableStatisticsViewProps {
    tableName: string;
    columnStats: ColumnStatistics[];
}

export class TableStatisticsView extends React.Component<TableStatisticsViewProps> {
    render() {
        const { tableName, columnStats } = this.props;
        
        return (
            <div className="h-[310px] flex flex-col">
                <ScrollArea className="flex-1 max-h-[310px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="bg-gray-100 text-[10px] text-gray-700 font-bold p-1.5 border-b border-primary">Column</TableHead>
                                <TableHead className="bg-white text-[10px] text-gray-700 p-1.5 border-b border-primary">Type</TableHead>
                                <TableHead className="bg-white text-[10px] text-gray-700 p-1.5 border-b border-primary text-right">Count</TableHead>
                                <TableHead className="bg-white text-[10px] text-gray-700 p-1.5 border-b border-primary text-right">Unique</TableHead>
                                <TableHead className="bg-white text-[10px] text-gray-700 p-1.5 border-b border-primary text-right">Null</TableHead>
                                <TableHead className="bg-white text-[10px] text-gray-700 p-1.5 border-b border-primary text-right">Min</TableHead>
                                <TableHead className="bg-white text-[10px] text-gray-700 p-1.5 border-b border-primary text-right">Max</TableHead>
                                <TableHead className="bg-white text-[10px] text-gray-700 p-1.5 border-b border-primary text-right">Avg</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {columnStats.map((stat, idx) => (
                                <TableRow 
                                    key={stat.column} 
                                    className="hover:bg-muted/50"
                                >
                                    <TableCell className="text-[10px] font-bold bg-gray-100 p-1.5">
                                        {stat.column}
                                    </TableCell>
                                    <TableCell className="text-[10px] p-1.5">
                                        {stat.type}
                                    </TableCell>
                                    <TableCell className="text-[10px] p-1.5 text-right">
                                        {stat.statistics.count}
                                    </TableCell>
                                    <TableCell className="text-[10px] p-1.5 text-right">
                                        {stat.statistics.unique_count}
                                    </TableCell>
                                    <TableCell className="text-[10px] p-1.5 text-right">
                                        {stat.statistics.null_count}
                                    </TableCell>
                                    <TableCell className="text-[10px] p-1.5 text-right">
                                        {stat.statistics.min !== undefined ? stat.statistics.min : '-'}
                                    </TableCell>
                                    <TableCell className="text-[10px] p-1.5 text-right">
                                        {stat.statistics.max !== undefined ? stat.statistics.max : '-'}
                                    </TableCell>
                                    <TableCell className="text-[10px] p-1.5 text-right">
                                        {stat.statistics.avg !== undefined ? 
                                            Number(stat.statistics.avg).toFixed(2) : '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        );
    }
}

export const DBTableSelectionDialog: React.FC<{ 
    buttonElement?: any, 
    className?: string,
    onOpen?: () => void,
    // Controlled mode props
    open?: boolean,
    onClose?: () => void
}> = function DBTableSelectionDialog({ 
    buttonElement,
    className,
    onOpen,
    open: controlledOpen,
    onClose,
}) {

    const dispatch = useDispatch<AppDispatch>();
    const sessionId = useSelector((state: DataFormulatorState) => state.sessionId);
    const tables = useSelector((state: DataFormulatorState) => state.tables);
    const serverConfig = useSelector((state: DataFormulatorState) => state.serverConfig);

    const [internalOpen, setInternalOpen] = useState<boolean>(false);
    
    // Support both controlled and uncontrolled modes
    const isControlled = controlledOpen !== undefined;
    const tableDialogOpen = isControlled ? controlledOpen : internalOpen;
    const setTableDialogOpen = isControlled 
        ? (open: boolean) => { if (!open && onClose) onClose(); }
        : setInternalOpen;
    const [tableAnalysisMap, setTableAnalysisMap] = useState<Record<string, ColumnStatistics[] | null>>({});
    
    // maps data loader type to list of param defs
    const [dataLoaderMetadata, setDataLoaderMetadata] = useState<Record<string, {
        params: {name: string, default: string, type: string, required: boolean, description: string}[], 
        auth_instructions: string}>>({});

    const [dbTables, setDbTables] = useState<DBTable[]>([]);
    const [selectedTabKey, setSelectedTabKey] = useState("");

    const [isUploading, setIsUploading] = useState<boolean>(false);

    let setSystemMessage = (content: string, severity: "error" | "warning" | "info" | "success") => {
        dispatch(dfActions.addMessages({
            "timestamp": Date.now(),
            "component": "DB manager",
            "type": severity,
            "value": content
        }));
    }

    useEffect(() => {
        fetchDataLoaders();
    }, []);

    useEffect(() => {
        if (!selectedTabKey.startsWith("dataLoader:") && dbTables.length == 0) {
            setSelectedTabKey("");
        } else if (!selectedTabKey.startsWith("dataLoader:") && dbTables.find(t => t.name === selectedTabKey) == undefined) {
            setSelectedTabKey(dbTables[0].name);
        }
    }, [dbTables]);

    // Fetch list of tables
    const fetchTables = async () => {
        if (serverConfig.DISABLE_DATABASE) return;
        try {
            const response = await fetch(getUrls().LIST_TABLES);
            const data = await response.json();
            if (data.status === 'success') {
                setDbTables(data.tables);
            }
        } catch (error) {
            setSystemMessage('Failed to fetch tables, please check if the server is running', "error");
        }
    };

    const fetchDataLoaders = async () => {
        fetch(getUrls().DATA_LOADER_LIST_DATA_LOADERS, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                setDataLoaderMetadata(data.data_loaders);
            } else {
                console.error('Failed to fetch data loader params:', data.error);
            }
        })
        .catch(error => {
            console.error('Failed to fetch data loader params:', error);
        });
    }

    const handleDBUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        const formData = new FormData();
        formData.append('file', file);
        formData.append('table_name', file.name.split('.')[0]);
    
        try {
            setIsUploading(true);
            const response = await fetch(getUrls().UPLOAD_DB_FILE, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.status === 'success') {
                fetchTables();  // Refresh table list
            } else {
                // Handle error from server
                setSystemMessage(data.error || 'Failed to upload table', "error");
            }
        } catch (error) {
            setSystemMessage('Failed to upload table, please check if the server is running', "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDBFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        const formData = new FormData();
        formData.append('file', file);
        formData.append('table_name', file.name.split('.')[0]);
    
        try {
            setIsUploading(true);
            const response = await fetch(getUrls().CREATE_TABLE, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.status === 'success') {
                if (data.is_renamed) {
                    setSystemMessage(`Table ${data.original_name} already exists. Renamed to ${data.table_name}`, "warning");
                } 
                fetchTables();  // Refresh table list
            } else {
                setSystemMessage(data.error || 'Failed to upload table', "error");
            }
        } catch (error) {
            setSystemMessage('Failed to upload table, please check if the server is running', "error");
        } finally {
            setIsUploading(false);
            // Clear the file input value to allow uploading the same file again
            if (event.target) {
                event.target.value = '';
            }
        }
    };

    const handleDBReset = async () => {
        try {
            const response = await fetch(getUrls().RESET_DB_FILE, {
                method: 'POST',
            });
            const data = await response.json();
            if (data.status === 'success') {
                fetchTables();
            } else {
                setSystemMessage(data.error || 'Failed to reset database', "error");
            }
        } catch (error) {
            setSystemMessage('Failed to reset database', "error");
        }
    }

    const handleCleanDerivedViews = async () => {
        let unreferencedViews = dbTables.filter(t => t.view_source !== null && t.view_source !== undefined && !tables.some(t2 => t2.id === t.name));

        if (unreferencedViews.length > 0) {
            if (confirm(`Are you sure you want to delete the following unreferenced derived views? \n${unreferencedViews.map(v => `- ${v.name}`).join("\n")}`)) {
                let deletedViews = [];
                for (let view of unreferencedViews) {
                    try {
                        const response = await fetch(getUrls().DELETE_TABLE, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ table_name: view.name })
                        });
                        const data = await response.json();
                        if (data.status === 'success') {
                            deletedViews.push(view.name);
                        } else {
                            setSystemMessage(data.error || 'Failed to delete table', "error");
                        }
                    } catch (error) {
                        setSystemMessage('Failed to delete table, please check if the server is running', "error");
                    }
                }
                if (deletedViews.length > 0) {
                    setSystemMessage(`Deleted ${deletedViews.length} unreferenced derived views: ${deletedViews.join(", ")}`, "success");
                }
                fetchTables();
                setSelectedTabKey(dbTables.length > 0 ? dbTables[0].name : "");
            }
        }
    }

    // Delete table
    const handleDropTable = async (tableName: string) => {
        if (tables.some(t => t.id === tableName)) {
            if (!confirm(`Are you sure you want to delete ${tableName}? \n ${tableName} is currently loaded into the data formulator and will be removed from the database.`)) return;
        }

        try {
            const response = await fetch(getUrls().DELETE_TABLE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ table_name: tableName })
            });
            const data = await response.json();
            if (data.status === 'success') {
                fetchTables();
                setSelectedTabKey(dbTables.length > 0 ? dbTables[0].name : "");
            } else {
                setSystemMessage(data.error || 'Failed to delete table', "error");
            }
        } catch (error) {
            setSystemMessage('Failed to delete table, please check if the server is running', "error");
        }
    };

    // Handle data analysis
    const handleAnalyzeData = async (tableName: string) => {
        if (!tableName) return;
        if (tableAnalysisMap[tableName]) return;

        console.log('Analyzing table:', tableName);
        
        try {
            const response = await fetch(getUrls().GET_COLUMN_STATS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ table_name: tableName })
            });
            const data = await response.json();
            if (data.status === 'success') {
                console.log('Analysis results:', data);
                // Update the analysis map with the new results
                setTableAnalysisMap(prevMap => ({
                    ...prevMap,
                    [tableName]: data.statistics
                }));
            }
        } catch (error) {
            console.error('Failed to analyze table data:', error);
            setSystemMessage('Failed to analyze table data, please check if the server is running', "error");
        }
    };

    // Toggle analysis view
    const toggleAnalysisView = (tableName: string) => {
        if (tableAnalysisMap[tableName]) {
            // If we already have analysis, remove it to show table data again
            setTableAnalysisMap(prevMap => {
                const newMap = { ...prevMap };
                delete newMap[tableName];
                return newMap;
            });
        } else {
            // If no analysis yet, fetch it
            handleAnalyzeData(tableName);
        }
    };

    const handleAddTableToDF = (dbTable: DBTable) => {
        const convertSqlTypeToAppType = (sqlType: string): Type => {
            // Convert SQL types to application types
            sqlType = sqlType.toUpperCase();
            if (sqlType.includes('INT') || sqlType === 'BIGINT' || sqlType === 'SMALLINT' || sqlType === 'TINYINT') {
                return Type.Integer;
            } else if (sqlType.includes('FLOAT') || sqlType.includes('DOUBLE') || sqlType.includes('DECIMAL') || sqlType.includes('NUMERIC') || sqlType.includes('REAL')) {
                return Type.Number;
            } else if (sqlType.includes('BOOL')) {
                return Type.Boolean;
            } else if (sqlType.includes('DATE') || sqlType.includes('TIME') || sqlType.includes('TIMESTAMP')) {
                return Type.Date;
            } else {
                return Type.String;
            }
        };

        let table: DictTable = {
            id: dbTable.name,
            displayId: dbTable.name,
            names: dbTable.columns.map((col: any) => col.name),
            metadata: dbTable.columns.reduce((acc: Record<string, {type: Type, semanticType: string, levels: any[]}>, col: any) => ({
                ...acc,
                [col.name]: {
                    type: convertSqlTypeToAppType(col.type),
                    semanticType: "",
                    levels: []
                }
            }), {}),
            rows: dbTable.sample_rows,
            virtual: {
                tableId: dbTable.name,
                rowCount: dbTable.row_count,
            },
            anchored: true, // by default, db tables are anchored
            createdBy: 'user',
            attachedMetadata: ''
        }
       dispatch(dfActions.loadTable(table));
       dispatch(fetchFieldSemanticType(table));
       setTableDialogOpen(false);
    }

    const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
        setSelectedTabKey(newValue);
    };

    useEffect(() => {
        if (tableDialogOpen) {
            fetchTables();
        }
    }, [tableDialogOpen]);

    let importButton = (buttonElement: React.ReactNode) => {
        return <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span>
                        <Button variant="ghost" className="text-inherit min-w-0 h-auto p-0" asChild disabled={isUploading}>
                            <label>
                                {buttonElement}
                                <input type="file" hidden onChange={handleDBUpload} accept=".db" disabled={isUploading} />
                            </label>
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>import a duckdb .db file to the local database</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    }

    let exportButton = 
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span>
                        <Button variant="ghost" size="sm" onClick={() => {
                            handleDBDownload(sessionId ?? '')
                                .catch(error => {
                                    console.error('Failed to download database:', error);
                                    setSystemMessage('Failed to download database file', "error");
                                });
                        }} disabled={isUploading || dbTables.length === 0}>
                            export
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>save the local database to a duckdb .db file</TooltipContent>
            </Tooltip>
        </TooltipProvider>

    function uploadFileButton(element: React.ReactNode, buttonClassName?: string) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>
                            <Button
                                variant="ghost"
                                className={cn("text-inherit", buttonClassName)}
                                asChild
                                disabled={isUploading}
                            >
                                <label>
                                    {element}
                                    <input
                                        type="file"
                                        hidden
                                        onChange={handleDBFileUpload}
                                        accept=".csv,.xlsx,.json"
                                        disabled={isUploading}
                                    />
                                </label>
                            </Button>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>upload a csv/tsv file to the local database</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    let hasDerivedViews = dbTables.filter(t => t.view_source !== null).length > 0;

    let dataLoaderPanel = <div className="p-2 flex flex-col bg-secondary/5">
        <div className="flex items-center px-2 mb-2">
            <span className="text-muted-foreground font-medium flex-grow text-xs">
                Data Connectors
            </span>
        </div>
        
        {["file upload", ...Object.keys(dataLoaderMetadata ?? {})].map((dataLoaderType, i) => (
            <Button
                key={`dataLoader:${dataLoaderType}`}
                variant="ghost"
                size="sm"
                onClick={() => {
                    setSelectedTabKey('dataLoader:' + dataLoaderType);
                }}
                className={cn(
                    "normal-case w-[120px] justify-start text-left rounded-none py-1 px-4",
                    selectedTabKey === 'dataLoader:' + dataLoaderType 
                        ? 'text-secondary border-r-2 border-secondary' 
                        : 'text-muted-foreground'
                )}
            >
                <span className="text-inherit w-[calc(100%-4px)] text-left truncate">
                    {dataLoaderType}
                </span>
            </Button>
        ))}
    </div>;

    let tableSelectionPanel = <div className="px-1 pt-2 flex flex-col bg-primary/5">
        <div className="flex items-center px-2 mb-2">
            <span className="text-muted-foreground font-medium flex-grow text-xs">
                Data Tables
            </span>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-primary hover:rotate-180 transition-transform duration-300"
                            onClick={() => { fetchTables(); }}
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>refresh the table list</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
        
        {dbTables.length == 0 && 
            <span className="text-gray-300 px-4 py-1 italic text-xs">
                no tables available
            </span>
        }
        
        {/* Regular Tables */}
        {dbTables.filter(t => t.view_source === null).map((t, i) => (
            <Button
                key={t.name}
                variant="ghost"
                size="sm"
                onClick={() => {
                    setSelectedTabKey(t.name);
                }}
                className={cn(
                    "normal-case w-[160px] justify-start text-left rounded-none py-1 px-4",
                    selectedTabKey === t.name 
                        ? 'text-primary border-r-2 border-primary' 
                        : 'text-muted-foreground'
                )}
            >
                <span className="text-inherit w-[calc(100%-4px)] text-left truncate">
                    {t.name}
                </span>
            </Button>
        ))}
        
        {/* Derived Views Section */}
        {hasDerivedViews && (
            <div className="mt-4 flex flex-col">
                <div className="flex items-center px-2 mb-2">
                    <span className="text-muted-foreground font-medium flex-grow text-xs">
                        Derived Views
                    </span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-6 w-6 text-primary hover:rotate-180 transition-transform duration-300"
                                    disabled={dbTables.filter(t => t.view_source !== null).length === 0}
                                    onClick={() => { handleCleanDerivedViews(); }}
                                >
                                    <Eraser className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>clean up unreferenced derived views</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                
                {dbTables.filter(t => t.view_source !== null).map((t, i) => (
                    <Button
                        key={t.name}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSelectedTabKey(t.name);
                        }}
                        className={cn(
                            "normal-case w-[160px] justify-start text-left rounded-none py-1 px-4 bg-transparent hover:bg-primary/10",
                            selectedTabKey === t.name 
                                ? 'text-primary border-r-2 border-primary' 
                                : 'text-muted-foreground'
                        )}
                    >
                        <span className="text-inherit w-[calc(100%-4px)] text-left truncate">
                            {t.name}
                        </span>
                    </Button>
                ))}
            </div>
        )}
    </div>

    let tableView = <div className="flex-1 w-[880px] overflow-auto p-4">
        {/* Empty state */}
        {selectedTabKey === '' && (
            <span className="text-muted-foreground px-2 text-xs">
                The database is empty, refresh the table list or import some data to get started.
            </span>
        )}
        
        {/* File upload */}
        {selectedTabKey === 'dataLoader:file upload' && (
            <div>
                {uploadFileButton(<span className="text-lg normal-case">{isUploading ? 'uploading...' : 'upload a csv/tsv file to the local database'}</span>)} 
            </div>
        )}
        
        {/* Data loader forms */}
        {dataLoaderMetadata && Object.entries(dataLoaderMetadata).map(([dataLoaderType, metadata]) => (
            selectedTabKey === 'dataLoader:' + dataLoaderType && (
                <div key={`dataLoader:${dataLoaderType}`} className="relative max-w-full">
                    <DataLoaderForm 
                        key={`data-loader-form-${dataLoaderType}`}
                        dataLoaderType={dataLoaderType} 
                        paramDefs={metadata.params}
                        authInstructions={metadata.auth_instructions}
                        onImport={() => {
                            setIsUploading(true);
                        }} 
                        onFinish={(status, message, importedTables) => {
                            setIsUploading(false);
                            fetchTables().then(() => {
                                // Navigate to the first imported table after tables are fetched
                                if (status === "success" && importedTables && importedTables.length > 0) {
                                    setSelectedTabKey(importedTables[0]);
                                }
                            });
                            if (status === "error") {
                                setSystemMessage(message, "error");
                            }
                        }} 
                    />
                </div>
            )
        ))}
        
        {/* Table content */}
        {dbTables.map((t, i) => {
            if (selectedTabKey !== t.name) return null;
            
            const currentTable = t;
            const showingAnalysis = tableAnalysisMap[currentTable.name] !== undefined;
            return (
                <div key={t.name} className="max-w-full overflow-x-auto flex flex-col gap-2">
                    <div className="border rounded-md">
                        <div className="px-2 flex items-center border-b border-black/10">
                            <span className="text-xs">
                                {showingAnalysis ? "column stats for " : "sample data from "} 
                                <span className="text-xs font-bold">
                                    {currentTable.name}
                                </span>
                                <span className="ml-2 text-[10px] text-muted-foreground">
                                    ({currentTable.columns.length} columns × {currentTable.row_count} rows)
                                </span>
                            </span>
                            <div className="ml-auto flex gap-2">
                                <Button 
                                    size="sm"
                                    variant="ghost"
                                    className={cn("normal-case", showingAnalysis ? "text-secondary" : "text-primary")}
                                    onClick={() => toggleAnalysisView(currentTable.name)}
                                >
                                    <BarChart3 className="h-4 w-4 mr-1" />
                                    {showingAnalysis ? "show data samples" : "show column stats"}
                                </Button>
                                <Button 
                                    size="icon" 
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDropTable(currentTable.name)}
                                    title="Drop Table"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        {showingAnalysis ? (
                            <TableStatisticsView 
                                tableName={currentTable.name}
                                columnStats={tableAnalysisMap[currentTable.name] ?? []}
                            />
                        ) : (
                            <CustomReactTable 
                                rows={currentTable.sample_rows.map((row: any) => {
                                    return Object.fromEntries(Object.entries(row).map(([key, value]: [string, any]) => {
                                        return [key, String(value)];
                                    }));
                                }).slice(0, 9)} 
                                columnDefs={currentTable.columns.map(col => ({
                                    id: col.name,
                                    label: col.name,
                                    minWidth: 60
                                }))}
                                rowsPerPageNum={-1}
                                compact={false}
                                isIncompleteTable={currentTable.row_count > 10}
                            />
                        )}
                    </div>
                    <Button 
                        variant="default"
                        size="sm"
                        className="ml-auto"
                        disabled={isUploading || dbTables.length === 0 || dbTables.find(t => t.name === selectedTabKey) === undefined}
                        onClick={() => {
                            let t = dbTables.find(t => t.name === selectedTabKey);
                            if (t) {
                                handleAddTableToDF(t);
                                setTableDialogOpen(false);
                            }
                        }}>
                        Load Table
                    </Button>
                </div>
            );
        })}
    </div>;

    let mainContent =  
        <div className="flex flex-row min-h-[400px] rounded-lg w-fit bg-white">
            {/* Button navigation - similar to TableSelectionView */}
            <div className="flex flex-col px-2 border-r border-border">
                <div className="min-w-[180px] flex flex-row flex-nowrap overflow-y-auto flex-grow">
                    {/* External Data Loaders Section */}
                    {dataLoaderPanel}
                    {/* Available Tables Section */}
                    {tableSelectionPanel}
                </div>
                <span className="mr-auto mt-auto mb-2 text-xs flex flex-wrap items-center gap-1">
                    {importButton(<span className="text-inherit">Import</span>)}
                    ,
                    {exportButton}
                    or
                    <Button
                        variant="ghost" 
                        size="sm"
                        className="text-amber-600 hover:text-amber-700 normal-case h-auto p-1"
                        onClick={handleDBReset}
                        disabled={isUploading}
                    >
                        reset
                    </Button>
                    the backend database
                </span>
            </div>
            {/* Content area - using conditional rendering instead of TabPanel */}
            {tableView}
        </div>  

    return (
        <>
            {buttonElement && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className={serverConfig.DISABLE_DATABASE ? 'cursor-help' : 'cursor-pointer'}>
                                <Button 
                                    variant="ghost" 
                                    className="text-inherit gap-2" 
                                    disabled={serverConfig.DISABLE_DATABASE} 
                                    onClick={() => {
                                        setTableDialogOpen(true);
                                        onOpen?.();
                                    }}
                                >
                                    {buttonElement}
                                </Button>
                            </span>
                        </TooltipTrigger>
                        {serverConfig.DISABLE_DATABASE && (
                            <TooltipContent>
                                <p className="text-[11px]">
                                    Install Data Formulator locally to use database. <br />
                                    Link: <a 
                                        href="https://github.com/microsoft/data-formulator" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-inherit underline"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        https://github.com/microsoft/data-formulator
                                    </a>
                                </p>
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>
            )}
            <Dialog
                open={tableDialogOpen}
                onOpenChange={(open) => { if (!open) setTableDialogOpen(false); }}
            >
                <DialogContent className="max-w-[95vw] max-h-[800px] min-w-[800px] p-0">
                    <DialogHeader className="flex flex-row items-center px-6 py-4 border-b">
                        <DialogTitle>Database</DialogTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-6 w-6"
                            onClick={() => setTableDialogOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogHeader>
                    <div className="p-2 relative">
                        {mainContent}
                        {isUploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-[1000]">
                                <Loader2 className="h-[60px] w-[60px] animate-spin text-primary" />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
  
}

export const DataLoaderForm: React.FC<{
    dataLoaderType: string, 
    paramDefs: {name: string, default: string, type: string, required: boolean, description: string}[],
    authInstructions: string,
    onImport: () => void,
    onFinish: (status: "success" | "error", message: string, importedTables?: string[]) => void
}> = ({dataLoaderType, paramDefs, authInstructions, onImport, onFinish}) => {

    const dispatch = useDispatch();
    const params = useSelector((state: DataFormulatorState) => state.dataLoaderConnectParams[dataLoaderType] ?? {});

    const [tableMetadata, setTableMetadata] = useState<Record<string, any>>({});    let [displaySamples, setDisplaySamples] = useState<Record<string, boolean>>({});
    let [tableFilter, setTableFilter] = useState<string>("");
    const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

    const [displayAuthInstructions, setDisplayAuthInstructions] = useState(false);

    let [isConnecting, setIsConnecting] = useState(false);
    let [mode, setMode] = useState<"view tables" | "query">("view tables");

    const toggleDisplaySamples = (tableName: string) => {
        setDisplaySamples({...displaySamples, [tableName]: !displaySamples[tableName]});
    }

    const handleModeChange = (newMode: "view tables" | "query") => {
        if (newMode != null) {
            setMode(newMode);
        }
    };

    let tableMetadataBox = [
        <div key="mode-toggle" className="my-4">
            <div className="inline-flex rounded-md border border-input">
                <Button
                    variant={mode === "view tables" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-r-none normal-case"
                    onClick={() => handleModeChange("view tables")}
                >
                    View Tables
                </Button>
                <Button
                    variant={mode === "query" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-l-none normal-case"
                    onClick={() => handleModeChange("query")}
                >
                    Query Data
                </Button>
            </div>
        </div>,
        mode === "view tables" && <ScrollArea key="table-container" className="max-h-[360px] border rounded-md">
            <Table>
                <TableBody>
                    {Object.entries(tableMetadata).map(([tableName, metadata]) => {
                        return [
                        <TableRow
                            key={tableName}
                            className={cn(
                                selectedTables.has(tableName) ? 'bg-accent' : '',
                                'hover:bg-muted/50'
                            )}
                        >
                            <TableCell className={cn("p-1", !displaySamples[tableName] && "border-b border-black/10")}>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleDisplaySamples(tableName)}>
                                    {displaySamples[tableName] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </TableCell>
                            <TableCell className={cn("max-w-[240px] p-1 break-words", !displaySamples[tableName] && "border-b border-black/10")}>
                                {tableName} <span className="text-muted-foreground text-[10px]">
                                    ({metadata.row_count > 0 ? `${metadata.row_count} rows × ` : ""}{metadata.columns.length} cols)
                                </span>
                            </TableCell>
                            <TableCell className="max-w-[500px] p-1">
                                {metadata.columns.map((column: any) => (
                                    <Badge key={column.name} variant="secondary" className="text-[11px] m-0.5 h-5">
                                        {column.name}
                                    </Badge>
                                ))}
                            </TableCell>
                            <TableCell className="w-10 p-1">
                                <Checkbox
                                    checked={selectedTables.has(tableName)}
                                    onCheckedChange={(checked) => {
                                        const newSelected = new Set(selectedTables);
                                        if (checked) {
                                            newSelected.add(tableName);
                                        } else {
                                            newSelected.delete(tableName);
                                        }
                                        setSelectedTables(newSelected);
                                    }}
                                />
                            </TableCell>
                        </TableRow>,
                        <TableRow key={`${tableName}-sample`}>
                            <TableCell colSpan={4} className={cn("p-0 max-w-[800px] overflow-x-auto", displaySamples[tableName] && "border-b border-black/10")}>
                                <Collapsible open={displaySamples[tableName]}>
                                    <CollapsibleContent>
                                        <div className="px-2 py-1">
                                            <CustomReactTable rows={metadata.sample_rows.slice(0, 9).map((row: any) => {
                                                return Object.fromEntries(Object.entries(row).map(([key, value]: [string, any]) => {
                                                    return [key, String(value)];
                                                }));
                                            })} 
                                            columnDefs={metadata.columns.map((column: any) => ({id: column.name, label: column.name}))} 
                                            rowsPerPageNum={-1} 
                                            compact={false} 
                                            isIncompleteTable={metadata.row_count > 10}
                                            />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </TableCell>
                        </TableRow>]
                    })}
                </TableBody>
            </Table>
        </ScrollArea>,
        mode === "view tables" && Object.keys(tableMetadata).length > 0 && <div key="import-button" className="flex justify-end mt-2">
            <Button 
                variant="default" 
                size="sm"
                disabled={selectedTables.size === 0}
                onClick={() => {
                    const tablesToImport = Array.from(selectedTables);
                    onImport();
                    
                    // Import all selected tables sequentially
                    const importPromises = tablesToImport.map(tableName => 
                        fetch(getUrls().DATA_LOADER_INGEST_DATA, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                data_loader_type: dataLoaderType, 
                                data_loader_params: params, 
                                table_name: tableName
                            })
                        }).then(response => response.json())
                    );
                    
                    Promise.all(importPromises)
                        .then(results => {
                            const errors = results.filter(r => r.status !== "success");
                            if (errors.length === 0) {
                                setSelectedTables(new Set());
                                onFinish("success", `Successfully imported ${tablesToImport.length} table(s)`, tablesToImport);
                            } else {
                                onFinish("error", `Failed to import some tables: ${errors.map(e => e.error).join(", ")}`);
                            }
                        })
                        .catch(error => {
                            console.error('Failed to ingest data:', error);
                            onFinish("error", `Failed to ingest data: ${error}`);
                        });
                }}
            >
                Import Selected ({selectedTables.size})
            </Button>
        </div>,
        mode === "query" && <DataQueryForm 
            key="query-form"
            dataLoaderType={dataLoaderType} 
            availableTables={Object.keys(tableMetadata).map(t => ({name: t, fields: tableMetadata[t].columns.map((c: any) => c.name)}))} 
            dataLoaderParams={params} onImport={onImport} onFinish={onFinish} />
    ]

    return (
        <div className="p-0">
            {isConnecting && <div className="absolute inset-0 flex items-center justify-center z-[1000] bg-white/70">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>}
            <p className="text-sm">
                Data Connector (<span className="text-secondary font-bold">{dataLoaderType}</span>)
            </p>
            <div className="flex flex-row flex-wrap gap-2 ml-8 mt-4">
                {paramDefs.map((paramDef) => (
                    <div key={paramDef.name} className="flex flex-col gap-1">
                        <Label htmlFor={paramDef.name} className="text-sm">
                            {paramDef.name}{paramDef.required && <span className="text-destructive">*</span>}
                        </Label>
                        <Input
                            id={paramDef.name}
                            disabled={Object.keys(tableMetadata).length > 0}
                            className="w-[270px] text-sm"
                            value={params[paramDef.name] ?? ''}
                            placeholder={paramDef.default ? `e.g. ${paramDef.default}` : paramDef.description}
                            onChange={(event: any) => { 
                                dispatch(dfActions.updateDataLoaderConnectParam({
                                    dataLoaderType, paramName: paramDef.name, 
                                    paramValue: event.target.value}));
                            }}
                        />
                    </div>
                ))}
                <div className="flex flex-col gap-1">
                    <Label className="text-sm text-secondary flex items-center gap-1">
                        <Search className="h-4 w-4" />
                        table filter
                    </Label>
                    <Input
                        className="w-[270px] text-sm hover:bg-secondary/5"
                        autoComplete="off"
                        placeholder="load only tables containing keywords"
                        value={tableFilter}
                        onChange={(event) => setTableFilter(event.target.value)}
                    />
                </div>
                {paramDefs.length > 0 && <div className="flex gap-0.5 h-8 mt-auto">
                    <Button 
                        size="sm"
                        className="normal-case rounded-r-none"
                        onClick={() => {
                            setIsConnecting(true);
                            setDisplayAuthInstructions(false);
                            fetch(getUrls().DATA_LOADER_LIST_TABLES, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    data_loader_type: dataLoaderType, 
                                    data_loader_params: params,
                                    table_filter: tableFilter.trim() || null
                                })
                        }).then(response => response.json())
                        .then(data => {
                            if (data.status === "success") {
                                console.log(data.tables);
                                setTableMetadata(Object.fromEntries(data.tables.map((table: any) => {
                                    return [table.name, table.metadata];
                                })));
                            } else {
                                console.error('Failed to fetch data loader tables: {}', data.message);
                                onFinish("error", `Failed to fetch data loader tables: ${data.message}`);
                            }
                            setIsConnecting(false);
                        })
                        .catch(error => {
                            onFinish("error", `Failed to fetch data loader tables, please check the server is running`);
                            setIsConnecting(false);
                        });
                    }}>
                        {Object.keys(tableMetadata).length > 0 ? "refresh" : "connect"} {tableFilter.trim() ? "with filter" : ""}
                    </Button>
                    <Button 
                        size="sm"
                        variant="outline"
                        className="normal-case rounded-l-none"
                        disabled={Object.keys(tableMetadata).length === 0}
                        onClick={() => {
                            setTableMetadata({});
                            setTableFilter("");
                        }}>
                        disconnect
                    </Button>
                </div>}

            </div>            
            <div className="flex flex-row items-center gap-2 ml-8 mt-8">
                
            </div>
            <Button
                variant="ghost" 
                size="sm" 
                className="normal-case h-8 mt-2"
                onClick={() => setDisplayAuthInstructions(!displayAuthInstructions)}>
                {displayAuthInstructions ? "hide" : "show"} authentication instructions
            </Button>
            <Collapsible open={displayAuthInstructions}>
                <CollapsibleContent>
                    <div className="border rounded-md px-2 py-1 max-h-[300px] overflow-y-auto">
                        <p className="text-xs whitespace-pre-wrap p-2">
                            {authInstructions.trim()}
                        </p>
                    </div>
                </CollapsibleContent>
            </Collapsible>
            
            {Object.keys(tableMetadata).length > 0 && tableMetadataBox }
        </div>
    );
}

export const DataQueryForm: React.FC<{
    dataLoaderType: string,
    availableTables: {name: string, fields: string[]}[],
    dataLoaderParams: Record<string, string>,
    onImport: () => void,
    onFinish: (status: "success" | "error", message: string) => void
}> = ({dataLoaderType, availableTables, dataLoaderParams, onImport, onFinish}) => {

    let activeModel = useSelector(dfSelectors.getActiveModel);

    const [selectedTables, setSelectedTables] = useState<string[]>(availableTables.map(t => t.name).slice(0, 5));

    const [waiting, setWaiting] = useState(false);

    const [query, setQuery] = useState("-- query the data source / describe your goal and ask AI to help you write the query\n");
    const [queryResult, setQueryResult] = useState<{
        status: string,
        message: string,
        sample: any[],
        code: string,
    } | undefined>(undefined);
    const [queryResultName, setQueryResultName] = useState("");
    
    const aiCompleteQuery = (query: string) => {
        if (queryResult?.status === "error") {
            setQueryResult(undefined);
        }
        let data = {
            data_source_metadata: {
                data_loader_type: dataLoaderType,
                tables: availableTables.filter(t => selectedTables.includes(t.name))
            },
            query: query,
            model: activeModel
        }
        setWaiting(true);
        fetch(getUrls().QUERY_COMPLETION, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            setWaiting(false);
            if (data.status === "ok") {
                setQuery(data.query);
            } else {
                onFinish("error", data.reasoning);
            }
        })
        .catch(error => {
            setWaiting(false);
            onFinish("error", `Failed to complete query please try again.`);
        });
    }

    const handleViewQuerySample = (query: string) => {
        setQueryResult(undefined);
        setWaiting(true);
        fetch(getUrls().DATA_LOADER_VIEW_QUERY_SAMPLE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data_loader_type: dataLoaderType,
                data_loader_params: dataLoaderParams,
                query: query
            })
        })
        .then(response => response.json())
        .then(data => {
            setWaiting(false);
            if (data.status === "success") {
                setQueryResult({
                    status: "success",
                    message: "Data loaded successfully",
                    sample: data.sample,
                    code: query
                });
                let newName = `r_${Math.random().toString(36).substring(2, 4)}`;
                setQueryResultName(newName);
            } else {
                setQueryResult({
                    status: "error",
                    message: data.message,
                    sample: [],
                    code: query
                });
            }
        })
        .catch(error => {
            setWaiting(false);
            setQueryResult({
                status: "error",
                message: `Failed to view query sample, please try again.`,
                sample: [],
                code: query
            });
        });
    }

    const handleImportQueryResult = () => {
        setWaiting(true);
        fetch(getUrls().DATA_LOADER_INGEST_DATA_FROM_QUERY, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data_loader_type: dataLoaderType,
                data_loader_params: dataLoaderParams,
                query: queryResult?.code ?? query,
                name_as: queryResultName
            })
        })
        .then(response => response.json())
        .then(data => {
            setWaiting(false);
            if (data.status === "success") {
                onFinish("success", "Data imported successfully");
            } else {
                onFinish("error", data.reasoning);
            }
        })
        .catch(error => {
            setWaiting(false);
            onFinish("error", `Failed to import data, please try again.`);
        });
    }

    let queryResultBox = queryResult?.status === "success" && queryResult.sample.length > 0 ? [
         <div key="query-result-table" className="flex flex-row gap-2 justify-between">
            <CustomReactTable rows={queryResult.sample} columnDefs={Object.keys(queryResult.sample[0]).map((t: any) => ({id: t, label: t}))} rowsPerPageNum={-1} compact={false} />
        </div>,
        <div key="query-result-controls" className="flex flex-row gap-2 items-center">
            <Button variant="outline" size="sm" className="normal-case min-w-[120px] mr-auto"
                onClick={() => {
                    setQueryResult(undefined);
                    setQueryResultName("");
                }}>
                clear result
            </Button>
            <div className="flex flex-col gap-1 ml-auto">
                <Label htmlFor="import-as" className="text-xs">import as</Label>
                <Input
                    id="import-as"
                    className="w-[120px] h-8 text-xs"
                    value={queryResultName}
                    onChange={(event: any) => setQueryResultName(event.target.value)}
                />
            </div>
            <Button variant="default" size="sm" disabled={queryResultName === ""} className="normal-case w-[120px] mt-auto"
                onClick={() => handleImportQueryResult()}>
            import data
            </Button> 
        </div>
    ] : [];
    
    return (
        <div className="flex flex-col gap-2 p-2 border rounded-md relative">
            {waiting && <div className="absolute inset-0 flex items-center justify-center z-[1000] bg-white/70">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>}
            <p className="text-sm text-muted-foreground">
                <span className="text-foreground text-[11px] mx-1">
                    query from tables:
                </span>
                {availableTables.map((table) => (
                    <Badge 
                        key={table.name} 
                        variant={selectedTables.includes(table.name) ? "default" : "outline"}
                        className={cn(
                            "text-[11px] m-0.5 h-5 rounded cursor-pointer",
                            selectedTables.includes(table.name) 
                                ? "border-primary text-primary-foreground" 
                                : "border-black/10 text-muted-foreground hover:bg-black/5"
                        )}
                        onClick={() => {
                            setSelectedTables(selectedTables.includes(table.name) ? selectedTables.filter(t => t !== table.name) : [...selectedTables, table.name]);
                        }}
                    >
                        {table.name}
                    </Badge>
                ))}
            </p>
            <div className="flex flex-col gap-2">
                <div className="max-h-[300px] overflow-y-auto">
                    <Editor
                        value={query}
                        onValueChange={(tempCode: string) => {
                            setQuery(tempCode);
                        }}
                        highlight={code => Prism.highlight(code, Prism.languages.sql, 'sql')}
                        padding={10}
                        style={{
                            minHeight: queryResult ? 60 : 200,
                            fontFamily: '"Fira code", "Fira Mono", monospace',
                            fontSize: 12,
                            paddingBottom: '24px',
                            backgroundColor: "rgba(0, 0, 0, 0.03)",
                            overflowY: "auto"
                        }}
                    />
                </div>
                {queryResult?.status === "error" && <div className="flex flex-row gap-2 items-center overflow-auto">
                        <p className="text-sm text-muted-foreground text-[11px] bg-red-100 p-1 rounded">
                            {queryResult?.message} 
                        </p>
                    </div>}
                <div className="flex flex-row gap-2 justify-end">
                    <Button variant="outline" size="sm" className="normal-case" disabled={queryResult?.status === "error"}
                        onClick={() => aiCompleteQuery(query)}>
                        <Bot className="h-4 w-4 mr-1" />
                        help me complete the query from selected tables
                    </Button>
                    {queryResult?.status === "error" && <Button variant="default" size="sm" className="normal-case min-w-[120px]"
                        onClick={() => aiCompleteQuery(queryResult.code + "\n error:" + queryResult.message)}>
                        <Bot className="h-4 w-4 mr-1" />
                        help me fix the error
                    </Button>}
                    <Button variant="default" size="sm" className="normal-case ml-auto w-20"
                        onClick={() => handleViewQuerySample(query)}>
                        run query
                    </Button>
                </div>
                {queryResult && queryResultBox}
            </div>
        </div>
    )
}