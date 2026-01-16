// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import DOMPurify from 'dompurify';

import { CustomReactTable } from './ReactTable';
import { DictTable } from "../components/ComponentType";

import { X } from 'lucide-react';
import { getUrls } from '../app/utils';
import { createTableFromFromObjectArray, createTableFromText, loadTextDataWrapper, loadBinaryDataWrapper } from '../data/utils';

import { DataFormulatorState, dfActions, dfSelectors, fetchFieldSemanticType } from '../app/dfSlice';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState, useCallback } from 'react';
import { AppDispatch } from '../app/store';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

    return (
	    <div
            role="tabpanel"
            hidden={value !== index}
            id={`vertical-tabpanel-${index}`}
            aria-labelledby={`vertical-tab-${index}`}
            style={{maxWidth: 'calc(100% - 120px)'}}
            {...other}
        >
            {value === index && (
                <div className="p-4">
                    {children}
                </div>
            )}
        </div>
    );
}

function a11yProps(index: number) {
  return {
	id: `vertical-tab-${index}`,
	'aria-controls': `vertical-tabpanel-${index}`,
  };
}

// Update the interface to support multiple tables per dataset
export interface DatasetMetadata {
    name: string;
    description: string;
    source: string;
    tables: {
        table_name: string;
        url: string;
        format: string;
        sample: any[];
    }[];
}

export interface DatasetSelectionViewProps {
    datasets: DatasetMetadata[];
    handleSelectDataset: (datasetMetadata: DatasetMetadata) => void;
    hideRowNum?: boolean;
}


export const DatasetSelectionView: React.FC<DatasetSelectionViewProps> = function DatasetSelectionView({ datasets, handleSelectDataset, hideRowNum  }) {

    const [selectedDatasetName, setSelectedDatasetName] = React.useState<string | undefined>(undefined);

    useEffect(() => {
        if (datasets.length > 0) {
            setSelectedDatasetName(datasets[0].name);
        }
    }, [datasets]);

    const handleDatasetSelect = (index: number) => {
        setSelectedDatasetName(datasets[index].name);
    };

    let datasetTitles : string[] = [];
    for (let i = 0; i < datasets.length; i ++) {
        let k = 0;
        let title = datasets[i].name;
        while (datasetTitles.includes(title)) {
            k = k + 1;
            title = `${title}_${k}`;
        }
        datasetTitles.push(title);
    }

    return (
        <div className="flex-grow flex h-[600px] rounded-lg bg-background">
            {/* Button navigation */}
            <div className="min-w-[180px] flex flex-col border-r border-border">
                {datasetTitles.map((title, i) => (
                    <Button
                        key={i}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDatasetSelect(i)}
                        className={cn(
                            "text-xs justify-start text-left rounded-none py-2 px-4 w-[180px]",
                            selectedDatasetName === title 
                                ? "text-primary border-r-2 border-primary" 
                                : "text-muted-foreground"
                        )}
                    >
                        {title}
                    </Button>
                ))}
            </div>

            {/* Content area */}
            <ScrollArea className="flex-1 p-4">
                {datasets.map((dataset, i) => {
                    if (dataset.name !== selectedDatasetName) return null;

                    let tableComponents = dataset.tables.map((table, j) => {
                        let t = createTableFromFromObjectArray(table.table_name, table.sample, true);
                        let maxDisplayRows = dataset.tables.length > 1 ? 5 : 9;
                        if (t.rows.length < maxDisplayRows) {
                            maxDisplayRows = t.rows.length - 1;
                        }
                        let sampleRows = [
                            ...t.rows.slice(0,maxDisplayRows), 
                            Object.fromEntries(t.names.map(n => [n, "..."]))
                        ];
                        let colDefs = t.names.map(name => { return {
                            id: name, label: name, minWidth: 60, align: undefined, format: (v: any) => v,
                        }})

                        let content = (
                            <Card className="w-[800px] max-w-full p-0 mb-2 border">
                                <CustomReactTable rows={sampleRows} columnDefs={colDefs} rowsPerPageNum={-1} compact={false} />
                            </Card>
                        );

                        return (
                            <div key={j}>
                                <p className="text-xs text-muted-foreground mb-2">
                                    {table.url.split("/").pop()?.split(".")[0]}  ({Object.keys(t.rows[0]).length} columns{hideRowNum ? "" : ` ⨉ ${t.rows.length} rows`})
                                </p>
                                {content}
                            </div>
                        )
                    });
                    
                    return (
                        <div key={i}>
                            <div className="mb-2 gap-2 max-w-[800px] flex items-center">
                                <p className="text-xs">
                                    {dataset.description} <span className="text-primary/70 text-[10px] mx-0.5">[from {dataset.source}]</span> 
                                </p>
                                <div className="ml-auto flex-shrink-0">
                                    <Button size="sm" 
                                            onClick={(event: React.MouseEvent<HTMLElement>) => {
                                                handleSelectDataset(dataset);
                                            }}>
                                        load dataset
                                    </Button>
                                </div>
                            </div>
                            {tableComponents}
                        </div>
                    );
                })}
            </ScrollArea>
        </div>
    );
}

export const DatasetSelectionDialog: React.FC<{ buttonElement: any }> = function DatasetSelectionDialog({ buttonElement }) {

    const [datasetPreviews, setDatasetPreviews] = React.useState<DatasetMetadata[]>([]);
    const [tableDialogOpen, setTableDialogOpen] = useState<boolean>(false);

    React.useEffect(() => {
        // Show a loading animation/message while loading
        fetch(`${getUrls().EXAMPLE_DATASETS}`)
            .then((response) => response.json())
            .then((result) => {
                let datasets : DatasetMetadata[] = result.map((info: any) => {
                    let tables = info["tables"].map((table: any) => {

                        if (table["format"] == "json") {
                            return {
                                table_name: table["name"],
                                url: table["url"],
                                format: table["format"],
                                sample: table["sample"],
                            }
                        }
                        else if (table["format"] == "csv" || table["format"] == "tsv") {
                            const delimiter = table["format"] === "csv" ? "," : "\t";
                            const rows = table["sample"]
                                .split("\n")
                                .map((row: string) => row.split(delimiter));
                            
                            // Treat first row as headers and convert to object array
                            if (rows.length > 0) {
                                const headers = rows[0];
                                const dataRows = rows.slice(1);
                                const sampleData = dataRows.map((row: string[]) => {
                                    const obj: any = {};
                                    headers.forEach((header: string, index: number) => {
                                        obj[header] = row[index] || '';
                                    });
                                    return obj;
                                });
                                
                                return {
                                    table_name: table["name"],
                                    url: table["url"],
                                    format: table["format"],
                                    sample: sampleData,
                                };
                            }
                            
                            return {
                                table_name: table["name"],
                                url: table["url"],
                                format: table["format"],
                                sample: [],
                            };
                        }
                    })
                    return {tables: tables, name: info["name"], description: info["description"], source: info["source"]}
                }).filter((t : DatasetMetadata | undefined) => t != undefined);
                setDatasetPreviews(datasets);
            });
      }, []);

    let dispatch = useDispatch<AppDispatch>();

    return <>
        <Button variant="ghost" className="text-inherit" onClick={() => {
            setTableDialogOpen(true);
        }}>
            {buttonElement}
        </Button>
        <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
            <DialogContent className="max-w-[95vw] max-h-[840px] min-w-[800px]" showCloseButton={true}>
                <DialogHeader>
                    <DialogTitle>Explore</DialogTitle>
                </DialogHeader>
                <div className="overflow-x-hidden p-1">
                    <DatasetSelectionView datasets={datasetPreviews} hideRowNum
                        handleSelectDataset={(dataset) => {
                            setTableDialogOpen(false);
                            for (let table of dataset.tables) { 
                                fetch(table.url)
                                .then(res => res.text())
                                .then(textData => {
                                    let tableName = table.url.split("/").pop()?.split(".")[0] || 'table-' + Date.now().toString().substring(0, 8);
                                    let dictTable;
                                    if (table.format == "csv") {
                                        dictTable = createTableFromText(tableName, textData);
                                    } else if (table.format == "json") {
                                        dictTable = createTableFromFromObjectArray(tableName, JSON.parse(textData), true);
                                    } 
                                    if (dictTable) {
                                        dispatch(dfActions.loadTable(dictTable));
                                        dispatch(fetchFieldSemanticType(dictTable));
                                    }
                                    
                                });
                            } 
                        }}/>
                </div>
            </DialogContent>
        </Dialog>
    </>
}

export interface TableUploadDialogProps {
    buttonElement?: any;
    disabled?: boolean;
    onOpen?: () => void;
    // For external control of file input
    fileInputRef?: React.RefObject<HTMLInputElement | null>;
}

const getUniqueTableName = (baseName: string, existingNames: Set<string>): string => {
    let uniqueName = baseName;
    let counter = 1;
    while (existingNames.has(uniqueName)) {
        uniqueName = `${baseName}_${counter}`;
        counter++;
    }
    return uniqueName;
};

export const TableUploadDialog: React.FC<TableUploadDialogProps> = ({ buttonElement, disabled, onOpen, fileInputRef }) => {
    const dispatch = useDispatch<AppDispatch>();
    const internalRef = React.useRef<HTMLInputElement>(null);
    const inputRef = fileInputRef || internalRef;
    const existingTables = useSelector((state: DataFormulatorState) => state.tables);
    const existingNames = new Set(existingTables.map(t => t.id));
    const serverConfig = useSelector((state: DataFormulatorState) => state.serverConfig);

    let handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const files = event.target.files;

        if (files) {
            for (let file of files) {
                const uniqueName = getUniqueTableName(file.name, existingNames);
                
                // Check if file is a text type (csv, tsv, json)
                if (file.type === 'text/csv' || 
                    file.type === 'text/tab-separated-values' || 
                    file.type === 'application/json' ||
                    file.name.endsWith('.csv') || 
                    file.name.endsWith('.tsv') || 
                    file.name.endsWith('.json')) {

                    // Check if file is larger than 5MB
                    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
                    if (file.size > MAX_FILE_SIZE) {
                        dispatch(dfActions.addMessages({
                            "timestamp": Date.now(),
                            "type": "error",
                            "component": "data loader",
                            "value": `File ${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB), upload it via DATABASE option instead.`
                        }));
                        continue; // Skip this file and process the next one
                    }
                    
                    // Handle text files
                    file.text().then((text) => {
                        let table = loadTextDataWrapper(uniqueName, text, file.type);
                        if (table) {
                            dispatch(dfActions.loadTable(table));
                            dispatch(fetchFieldSemanticType(table));
                        }
                    });
                } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                           file.type === 'application/vnd.ms-excel' ||
                           file.name.endsWith('.xlsx') || 
                           file.name.endsWith('.xls')) {
                    // Handle Excel files
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const arrayBuffer = e.target?.result as ArrayBuffer;
                        if (arrayBuffer) {
                            try {
                                let tables = await loadBinaryDataWrapper(uniqueName, arrayBuffer);
                                for (let table of tables) {
                                    dispatch(dfActions.loadTable(table));
                                    dispatch(fetchFieldSemanticType(table));
                                }
                                if (tables.length == 0) {
                                    dispatch(dfActions.addMessages({
                                        "timestamp": Date.now(),
                                        "type": "error",
                                        "component": "data loader",
                                        "value": `Failed to parse Excel file ${file.name}. Please check the file format.`
                                    }));
                                }
                            } catch (error) {
                                console.error('Error processing Excel file:', error);
                                dispatch(dfActions.addMessages({
                                    "timestamp": Date.now(),
                                    "type": "error",
                                    "component": "data loader",
                                    "value": `Failed to parse Excel file ${file.name}. Please check the file format.`
                                }));
                            }
                        }
                    };
                    reader.readAsArrayBuffer(file);
                } else {
                    // Unsupported file type
                    dispatch(dfActions.addMessages({
                        "timestamp": Date.now(),
                        "type": "error",
                        "component": "data loader",
                        "value": `Unsupported file format: ${file.name}. Please use CSV, TSV, JSON, or Excel files.`
                    }));
                }
            }
        }
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <>
            <input
                accept=".csv,.tsv,.json,.xlsx,.xls"
                multiple
                id="upload-data-file"
                type="file"
                className="hidden"
                ref={inputRef}
                onChange={handleFileUpload}
            />
            {buttonElement && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span style={{cursor: serverConfig.DISABLE_FILE_UPLOAD ? 'help' : 'pointer'}}>
                            <Button 
                                variant="ghost"
                                className="text-inherit" 
                                disabled={disabled || serverConfig.DISABLE_FILE_UPLOAD}
                                onClick={() => {
                                    inputRef.current?.click();
                                    onOpen?.();
                                }}
                            >
                                {buttonElement}
                            </Button>
                        </span>
                    </TooltipTrigger>
                    {serverConfig.DISABLE_FILE_UPLOAD && (
                        <TooltipContent side="top">
                            <p className="text-xs">
                                Install Data Formulator locally to enable file upload. <br />
                                Link: <a 
                                    href="https://github.com/microsoft/data-formulator" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    https://github.com/microsoft/data-formulator
                                </a>
                            </p>
                        </TooltipContent>
                    )}
                </Tooltip>
            )}
        </>
    );
}


export interface TableCopyDialogProps {
    buttonElement?: any;
    disabled?: boolean;
    onOpen?: () => void;
    // Controlled mode props
    open?: boolean;
    onClose?: () => void;
}

export interface TableURLDialogProps {
    buttonElement: any;
    disabled: boolean;
}

export const TableURLDialog: React.FC<TableURLDialogProps> = ({ buttonElement, disabled }) => {

    const [dialogOpen, setDialogOpen] = useState<boolean>(false);
    const [tableURL, setTableURL] = useState<string>("");

    const dispatch = useDispatch<AppDispatch>();

    let handleSubmitContent = (): void => {

        let  parts = tableURL.split('/');

        // Get the last part of the URL, which should be the file name with extension
        const tableName = parts[parts.length - 1];

        fetch(tableURL)
        .then(res => res.text())
        .then(content => {
            let table : undefined | DictTable = undefined;
            try {
                let jsonContent = JSON.parse(content);
                table = createTableFromFromObjectArray(tableName || 'dataset', jsonContent, true);
            } catch (error) {
                table = createTableFromText(tableName || 'dataset', content);
            }

            if (table) {
                dispatch(dfActions.loadTable(table));
                dispatch(fetchFieldSemanticType(table));
            }        
        })
    };

    let hasValidSuffix = tableURL.endsWith('.csv') || tableURL.endsWith('.tsv') || tableURL.endsWith(".json");

    return <>
        <Button variant="ghost" className="text-inherit" 
                    disabled={disabled} onClick={()=>{setDialogOpen(true)}}>
            {buttonElement}
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-[80vw] max-h-[800px] min-w-[800px]">
                <DialogHeader>
                    <DialogTitle>Upload data URL</DialogTitle>
                </DialogHeader>
                <div className="overflow-x-hidden p-2 flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="dataset-url">Data URL</Label>
                        <Input 
                            id="dataset-url"
                            autoFocus 
                            placeholder="Please enter URL of the dataset" 
                            className={cn(
                                "mb-1",
                                tableURL !== "" && !hasValidSuffix && "border-destructive"
                            )}
                            value={tableURL} 
                            onChange={(event) => { setTableURL(event.target.value.trim()); }} 
                        />
                        {!hasValidSuffix && tableURL !== "" && (
                            <p className="text-xs text-destructive">The URL should link to a CSV, TSV, or JSON file</p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={()=>{ setDialogOpen(false); }}>Cancel</Button>
                    <Button size="sm" onClick={()=>{ setDialogOpen(false); handleSubmitContent(); }}>
                        Upload
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>;
}


export const TableCopyDialogV2: React.FC<TableCopyDialogProps> = ({ 
    buttonElement, 
    disabled, 
    onOpen,
    open: controlledOpen,
    onClose,
}) => {

    const [internalOpen, setInternalOpen] = useState<boolean>(false);
    
    // Support both controlled and uncontrolled modes
    const isControlled = controlledOpen !== undefined;
    const dialogOpen = isControlled ? controlledOpen : internalOpen;
    
    const [tableContent, setTableContent] = useState<string>("");
    const [tableContentType, setTableContentType] = useState<'text' | 'image'>('text');

    const [cleaningInProgress, setCleaningInProgress] = useState<boolean>(false);

    // Add new state for display optimization
    const [displayContent, setDisplayContent] = useState<string>("");
    const [isLargeContent, setIsLargeContent] = useState<boolean>(false);
    const [showFullContent, setShowFullContent] = useState<boolean>(false);
    const [isOverSizeLimit, setIsOverSizeLimit] = useState<boolean>(false);
    
    // Constants for content size limits
    const MAX_DISPLAY_LINES = 20; // Reduced from 30
    const LARGE_CONTENT_THRESHOLD = 50000; // ~50KB threshold
    const MAX_CONTENT_SIZE = 2 * 1024 * 1024; // 2MB in bytes (same as file upload limit)

    const dispatch = useDispatch<AppDispatch>();
    const existingTables = useSelector((state: DataFormulatorState) => state.tables);
    const existingNames = new Set(existingTables.map(t => t.id));

    let handleSubmitContent = (tableStr: string): void => {
        let table: undefined | DictTable = undefined;
        
        // Generate a short unique name based on content and time if no name provided
        const defaultName = (() => {
            const hashStr = tableStr.substring(0, 100) + Date.now();
            const hashCode = hashStr.split('').reduce((acc, char) => {
                return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
            }, 0);
            const shortHash = Math.abs(hashCode).toString(36).substring(0, 4);
            return `data-${shortHash}`;
        })();

        const baseName = defaultName;
        const uniqueName = getUniqueTableName(baseName, existingNames);

        try {
            let content = JSON.parse(tableStr);
            table = createTableFromFromObjectArray(uniqueName, content, true);
        } catch (error) {
            table = createTableFromText(uniqueName, tableStr);
        }
        if (table) {
            dispatch(dfActions.loadTable(table));
            dispatch(fetchFieldSemanticType(table));
        }        
    };

    // Optimized content change handler
    const handleContentChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = event.target.value;
        setTableContent(newContent);
        
        // Check if content exceeds size limit
        const contentSizeBytes = new Blob([newContent]).size;
        const isOverLimit = contentSizeBytes > MAX_CONTENT_SIZE;
        setIsOverSizeLimit(isOverLimit);
        
        // Check if content is large
        const isLarge = newContent.length > LARGE_CONTENT_THRESHOLD;
        setIsLargeContent(isLarge);
        
        if (isLarge && !showFullContent) {
            // For large content, only show a preview in the TextField
            const lines = newContent.split('\n');
            const previewLines = lines.slice(0, MAX_DISPLAY_LINES);
            const preview = previewLines.join('\n') + (lines.length > MAX_DISPLAY_LINES ? '\n... (truncated for performance)' : '');
            setDisplayContent(preview);
        } else {
            setDisplayContent(newContent);
        }
    }, [showFullContent, dispatch, MAX_CONTENT_SIZE]);

    // Toggle between preview and full content
    const toggleFullContent = useCallback(() => {
        setShowFullContent(!showFullContent);
        if (!showFullContent) {
            setDisplayContent(tableContent);
        } else {
            const lines = tableContent.split('\n');
            const previewLines = lines.slice(0, MAX_DISPLAY_LINES);
            const preview = previewLines.join('\n') + (lines.length > MAX_DISPLAY_LINES ? '\n... (truncated for performance)' : '');
            setDisplayContent(preview);
        }
    }, [showFullContent, tableContent]);


    const handleCloseDialog = useCallback(() => {
        if (isControlled) {
            onClose?.();
        } else {
            setInternalOpen(false);
        }
        // Reset state when closing
        setTableContent("");
        setDisplayContent("");
        setIsLargeContent(false);
        setIsOverSizeLimit(false);
        setShowFullContent(false);
    }, [isControlled, onClose]);

    return <>
        {buttonElement && (
            <Button variant="ghost" className="text-inherit" 
                        disabled={disabled} onClick={()=>{
                            setInternalOpen(true);
                            onOpen?.();
                        }}>
                    {buttonElement}
            </Button>
        )}
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
            <DialogContent className="max-w-[80vw] max-h-[800px] min-w-[800px]">
                <DialogHeader>
                    <DialogTitle>Paste & Upload Data</DialogTitle>
                </DialogHeader>
                <div className="overflow-x-hidden p-2 flex flex-col">
                    <div className="w-full flex relative overflow-auto">
                        {cleaningInProgress && tableContentType === "text" && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
                                <Progress value={undefined} className="w-full h-full opacity-10" />
                            </div>
                        )}
                        <div className="flex-1 flex flex-col">
                            {/* Size limit warning */}
                            {isOverSizeLimit && (
                                <div className="flex items-center mb-2 p-2 bg-destructive/10 rounded border border-destructive/30">
                                    <p className="flex-1 text-xs text-destructive font-medium">
                                        ⚠️ Content exceeds {(MAX_CONTENT_SIZE / (1024 * 1024)).toFixed(0)}MB size limit. 
                                        Current size: {(new Blob([tableContent]).size / (1024 * 1024)).toFixed(2)}MB. 
                                        Please use the DATABASE option for large datasets.
                                    </p>
                                </div>
                            )}
                            {/* Content size indicator */}
                            {isLargeContent && !isOverSizeLimit && (
                                <div className="flex items-center mb-2 p-2 bg-yellow-500/10 rounded">
                                    <p className="flex-1 text-xs">
                                        Large content detected ({Math.round(tableContent.length / 1000)}KB). 
                                        {showFullContent ? 'Showing full content (may be slow)' : 'Showing preview for performance'}
                                    </p>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={toggleFullContent}
                                    >
                                        {showFullContent ? 'Show Preview' : 'Show Full'}
                                    </Button>
                                </div>
                            )}
                            
                            <div className="flex flex-col gap-1 mt-2">
                                <Label htmlFor="upload-content">Data Content</Label>
                                <Textarea 
                                    disabled={cleaningInProgress} 
                                    autoFocus 
                                    className={cn(
                                        "text-xs leading-tight min-h-[200px]",
                                        isLargeContent && !showFullContent ? "max-h-[300px]" : "max-h-[400px]",
                                        cleaningInProgress && "opacity-50"
                                    )}
                                    id="upload-content" 
                                    value={displayContent} 
                                    rows={isLargeContent && !showFullContent ? MAX_DISPLAY_LINES : 15}
                                    onChange={handleContentChange}
                                    placeholder="Paste data (CSV, TSV, or JSON) and upload it!"
                                    onPaste={(e) => {
                                        if (e.clipboardData.files.length > 0) {
                                            let file = e.clipboardData.files[0];
                                            let read = new FileReader();

                                            read.readAsDataURL(file);
                                            read.onloadend = function(){
                                                let res = read.result;
                                                console.log(res);
                                                if (res) { 
                                                    setTableContent(res as string); 
                                                    setTableContentType("image");
                                                }
                                            }
                                        }
                                    }}
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" size="sm" onClick={handleCloseDialog}>Cancel</Button>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button 
                                    disabled={tableContentType !== "text" || tableContent.trim() === "" || isOverSizeLimit} 
                                    size="sm" 
                                    onClick={()=>{ 
                                        handleCloseDialog(); 
                                        handleSubmitContent(tableContent); // Always use full content for processing
                                    }}
                                >
                                    Upload
                                </Button>
                            </span>
                        </TooltipTrigger>
                        {isOverSizeLimit && (
                            <TooltipContent side="top">
                                Content exceeds {(MAX_CONTENT_SIZE / (1024 * 1024)).toFixed(0)}MB size limit
                            </TooltipContent>
                        )}
                    </Tooltip>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>;
}

