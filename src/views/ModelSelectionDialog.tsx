// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useEffect, useState } from 'react';
import '../scss/App.scss';

import { useDispatch, useSelector } from "react-redux";
import { 
    DataFormulatorState,
    dfActions,
    ModelConfig,
    dfSelectors,
} from '../app/dfSlice'

import _ from 'lodash';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { 
    PlusCircle, 
    X, 
    Eye, 
    EyeOff, 
    CheckCircle, 
    XCircle, 
    HelpCircle, 
    Info,
    Loader2
} from 'lucide-react';

import { getUrls } from '../app/utils';


const decodeHtmlEntities = (text: string): string => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
};

// Add this helper function at the top of the file, after the imports
const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
};

export const ModelSelectionButton: React.FC<{}> = ({ }) => {

    const dispatch = useDispatch();
    const models = useSelector((state: DataFormulatorState) => state.models);
    const selectedModelId = useSelector((state: DataFormulatorState) => state.selectedModelId);
    const testedModels = useSelector((state: DataFormulatorState) => state.testedModels);

    const [modelDialogOpen, setModelDialogOpen] = useState<boolean>(false);
    const [showKeys, setShowKeys] = useState<boolean>(false);
    const [providerModelOptions, setProviderModelOptions] = useState<{[key: string]: string[]}>({
        'openai': [],
        'azure': [],
        'anthropic': [],
        'gemini': [],
        'ollama': []
    });
    const serverConfig = useSelector((state: DataFormulatorState) => state.serverConfig);

    let updateModelStatus = (model: ModelConfig, status: 'ok' | 'error' | 'testing' | 'unknown', message: string) => {
        dispatch(dfActions.updateModelStatus({id: model.id, status, message}));
    }
    let getStatus = (id: string | undefined) => {
        return id != undefined ? (testedModels.find(t => (t.id == id))?.status || 'unknown') : 'unknown';
    }

    // Helper functions for slot management
    const [tempSelectedModelId, setTempSelectedModelId] = useState<string | undefined>(selectedModelId);
    const [newEndpoint, setNewEndpoint] = useState<string>(""); // openai, azure, ollama etc
    const [newModel, setNewModel] = useState<string>("");
    const [newApiKey, setNewApiKey] = useState<string>("");
    const [newApiBase, setNewApiBase] = useState<string>("");
    const [newApiVersion, setNewApiVersion] = useState<string>("");

    // Fetch available models from the API
    useEffect(() => {
        const fetchModelOptions = async () => {
            try {
                const response = await fetch(getUrls().CHECK_AVAILABLE_MODELS);
                const data = await response.json();
                
                // Group models by provider
                const modelsByProvider: {[key: string]: string[]} = {
                    'openai': [],
                    'azure': [],
                    'anthropic': [],
                    'gemini': [],
                    'ollama': []
                };
                
                data.forEach((modelConfig: any) => {
                    const provider = modelConfig.endpoint;
                    const model = modelConfig.model;

                    if (provider && model && !modelsByProvider[provider]) {
                        modelsByProvider[provider] = [];
                    }
                    
                    if (provider && model && !modelsByProvider[provider].includes(model)) {
                        modelsByProvider[provider].push(model);
                    }
                });
                
                setProviderModelOptions(modelsByProvider);
                
            } catch (error) {
                console.error("Failed to fetch model options:", error);
            } 
        };
        
        fetchModelOptions();
    }, []);


    let modelExists = models.some(m => 
        m.endpoint == newEndpoint && m.model == newModel && m.api_base == newApiBase 
        && m.api_key == newApiKey && m.api_version == newApiVersion);

    let testModel = (model: ModelConfig) => {
        updateModelStatus(model, 'testing', "");
        let message = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({
                model: model,
            }),
        };
        fetch(getUrls().TEST_MODEL, {...message })
            .then((response) => response.json())
            .then((data) => {
                let status = data["status"] || 'error';
                updateModelStatus(model, status, data["message"] || "");
                // Auto-select the first good model if none is currently selected
                if (status === 'ok' && !tempSelectedModelId) {
                    setTempSelectedModelId(model.id);
                }
            }).catch((error) => {
                updateModelStatus(model, 'error', error.message)
            });
    }

    let readyToTest = newModel && (newApiKey || newApiBase);

    let newModelEntry = (
        <TableRow key="new-model-entry">
            <TableCell className="w-[120px]">
                <Input
                    value={newEndpoint}
                    onChange={(e) => {
                        const val = e.target.value;
                        setNewEndpoint(val);
                        if (newModel == "" && val == "openai" && providerModelOptions.openai.length > 0) {
                            setNewModel(providerModelOptions.openai[0]);
                        }
                        if (!newApiVersion && val == "azure") {
                            setNewApiVersion("2024-02-15");
                        }
                    }}
                    placeholder="provider"
                    className="h-8 text-xs"
                    list="provider-options"
                />
                <datalist id="provider-options">
                    {['openai', 'azure', 'ollama', 'anthropic', 'gemini'].map(opt => (
                        <option key={opt} value={opt} />
                    ))}
                </datalist>
            </TableCell>
            <TableCell className="min-w-[180px]">
                <Input
                    type={showKeys ? "text" : "password"}
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="optional for keyless endpoint"
                    className="h-8 text-xs"
                    autoComplete="off"
                />
            </TableCell>
            <TableCell>
                <Input
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="e.g., gpt-5.1"
                    className={cn("h-8 text-xs", newEndpoint && !newModel && "border-destructive")}
                />
            </TableCell>
            <TableCell>
                <Input
                    value={newApiBase}
                    onChange={(e) => setNewApiBase(e.target.value)}
                    placeholder="optional"
                    className="h-8 text-xs"
                    autoComplete="off"
                />
            </TableCell>
            <TableCell>
                <Input
                    value={newApiVersion}
                    onChange={(e) => setNewApiVersion(e.target.value)}
                    placeholder="optional"
                    className="h-8 text-xs"
                    autoComplete="off"
                />
            </TableCell>
            <TableCell>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8", modelExists ? "text-destructive" : "text-primary")}
                                disabled={!readyToTest}
                                onClick={(event) => {
                                    event.stopPropagation();

                                    let endpoint = newEndpoint;
                                    const idString = `${endpoint}-${newModel}-${newApiKey}-${newApiBase}-${newApiVersion}`;
                                    let id = simpleHash(idString);
                                    let model = {endpoint, model: newModel, api_key: newApiKey, api_base: newApiBase, api_version: newApiVersion, id: id};

                                    dispatch(dfActions.addModel(model));

                                    const testAndAssignModel = (model: ModelConfig) => {
                                        updateModelStatus(model, 'testing', "");
                                        let message = {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', },
                                            body: JSON.stringify({ model: model }),
                                        };
                                        fetch(getUrls().TEST_MODEL, {...message })
                                            .then((response) => response.json())
                                            .then((data) => {
                                                let status = data["status"] || 'error';
                                                updateModelStatus(model, status, data["message"] || "");
                                                if (status === 'ok') {
                                                    setTempSelectedModelId(id);
                                                }
                                            }).catch((error) => {
                                                updateModelStatus(model, 'error', error.message);
                                            });
                                    };

                                    testAndAssignModel(model); 
                                    
                                    setNewEndpoint("");
                                    setNewModel("");
                                    setNewApiKey("");
                                    setNewApiBase("");
                                    setNewApiVersion("");
                                }}
                            >
                                <PlusCircle className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {modelExists ? "provider + model already exists" : "add and test model"}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
            <TableCell>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setNewEndpoint("");
                                    setNewModel("");
                                    setNewApiKey("");
                                    setNewApiBase("");
                                    setNewApiVersion("");
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>clear</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </TableCell>
        </TableRow>
    );

    let modelTable = (
        <div className="overflow-auto">
            <Table className="min-w-[600px]">
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-bold w-[120px] text-xs">Provider</TableHead>
                        <TableHead className="font-bold w-[160px] text-xs">API Key</TableHead>
                        <TableHead className="font-bold w-[160px] text-xs">Model</TableHead>
                        <TableHead className="font-bold w-[200px] text-xs">API Base</TableHead>
                        <TableHead className="font-bold w-[120px] text-xs">API Version</TableHead>
                        <TableHead className="font-bold text-xs">Status</TableHead>
                        <TableHead className="font-bold text-xs"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {models.map((model) => {
                        let status = getStatus(model.id);  
                        
                        let statusIcon = status === "unknown" 
                            ? <HelpCircle className="h-4 w-4 text-yellow-500" /> 
                            : (status === 'testing' 
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : (status === "ok" 
                                    ? <CheckCircle className="h-4 w-4 text-green-500" /> 
                                    : <XCircle className="h-4 w-4 text-red-500" />));
                        
                        let message = "Model is ready to use";
                        if (status === "unknown") {
                            message = "Click to test if this model is working";
                        } else if (status === "error") {
                            const rawMessage = testedModels.find(t => t.id == model.id)?.message || "Unknown error";
                            message = `Error: ${decodeHtmlEntities(rawMessage)}. Click to retest.`;
                        }

                        const isError = status === 'error';
                        const disabledStyle = status !== 'ok' ? "opacity-50" : "";
                        
                        return (
                            <React.Fragment key={model.id}>
                                <TableRow
                                    className={cn(
                                        "hover:bg-muted/50",
                                        tempSelectedModelId === model.id && "ring-2 ring-primary",
                                        status === 'ok' ? "cursor-pointer" : "cursor-default"
                                    )}
                                    onClick={() => status === 'ok' && setTempSelectedModelId(tempSelectedModelId === model.id ? undefined : model.id)}
                                >
                                    <TableCell className={cn("text-xs", disabledStyle)}>
                                        <span className="font-medium">{model.endpoint}</span>
                                    </TableCell>
                                    <TableCell className={cn("text-xs", disabledStyle)}>
                                        {model.api_key ? (showKeys ? 
                                            <span className="max-w-[220px] break-all font-mono text-[0.5rem] leading-tight">
                                                {model.api_key}
                                            </span> 
                                            : <span className="font-mono text-muted-foreground">••••••••••••</span>)
                                             : <span className="text-muted-foreground italic">None</span>
                                        }
                                    </TableCell>
                                    <TableCell className={cn("text-xs", disabledStyle)}>
                                        <span className="font-medium">{model.model}</span>
                                    </TableCell>
                                    <TableCell className={cn("text-xs", disabledStyle)}>
                                        {model.api_base ? (
                                            <span className="max-w-[220px] break-all leading-tight">
                                                {model.api_base}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground italic">Default</span>
                                        )}
                                    </TableCell>
                                    <TableCell className={cn("text-xs", disabledStyle)}>
                                        {model.api_version ? (
                                            <span>{model.api_version}</span>
                                        ) : (
                                            <span className="text-muted-foreground italic">Default</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "h-7 text-xs",
                                                            status === 'ok' && "text-green-600",
                                                            status === 'error' && "text-red-600",
                                                            status === 'unknown' && "text-yellow-600"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            testModel(model);
                                                        }}
                                                    >
                                                        {statusIcon}
                                                        <span className="ml-1.5">
                                                            {status === 'ok' ? 'Ready' : status === 'error' ? 'Retest' : 'Test'}
                                                        </span>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs">{message}</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                    <TableCell>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            dispatch(dfActions.removeModel(model.id));
                                                            if (tempSelectedModelId === model.id) {
                                                                setTempSelectedModelId(undefined);
                                                            }
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>remove model</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </TableCell>
                                </TableRow>
                                {isError && (
                                    <TableRow>
                                        <TableCell></TableCell>
                                        <TableCell colSpan={6}>
                                            <span className="text-[0.625rem] text-red-600">{message}</span>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        );
                    })}
                    {newModelEntry}
                </TableBody>
            </Table>
        </div>
    );

    let modelNotReady = tempSelectedModelId == undefined || getStatus(tempSelectedModelId) !== 'ok';

    let tempModel = models.find(m => m.id == tempSelectedModelId);
    let tempModelName = tempModel ? `${tempModel.endpoint}/${tempModel.model}` : 'Please select a model';
    let selectedModelName = models.find(m => m.id == selectedModelId)?.model || 'Unselected';

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="link" 
                            className={cn("text-inherit p-0 h-auto", modelNotReady && "text-yellow-600")}
                            onClick={() => setModelDialogOpen(true)}
                        >
                            {modelNotReady ? 'Select Models' : selectedModelName}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Select a model</TooltipContent>
                </Tooltip>
            </TooltipProvider>
            
            <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">Select a model</DialogTitle>
                        <DialogDescription>
                            Configure and select an AI model for data exploration
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md mb-4">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            • Models with strong code generation capabilities (e.g., <code className="bg-muted px-1 py-0.5 rounded text-[0.7rem]">gpt-5.1</code>, <code className="bg-muted px-1 py-0.5 rounded text-[0.7rem]">claude-sonnet-4-5</code>) provide best experience.
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                            • Model configuration based on LiteLLM. <a href="https://docs.litellm.ai/docs/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">See supported providers</a>.
                            Use <code className="bg-muted px-1 py-0.5 rounded text-[0.7rem]">openai</code> provider for OpenAI-compatible APIs.
                        </p>
                    </div>
                    
                    <ScrollArea className="flex-1 -mx-6 px-6">
                        {modelTable}
                    </ScrollArea>
                    
                    <DialogFooter className="flex-row justify-between sm:justify-between gap-2 pt-4">
                        {!serverConfig.DISABLE_DISPLAY_KEYS && (
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setShowKeys(!showKeys)}
                                className="mr-auto"
                            >
                                {showKeys ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                                {showKeys ? 'hide' : 'show'} keys
                            </Button>
                        )}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setTempSelectedModelId(selectedModelId);
                                    setModelDialogOpen(false);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={modelNotReady}
                                variant={modelNotReady ? "outline" : "default"}
                                onClick={() => {
                                    dispatch(dfActions.selectModel(tempSelectedModelId));
                                    setModelDialogOpen(false);
                                }}
                            >
                                Use {tempModelName}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
