// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { FC, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { DataFormulatorState, dfActions } from '../app/dfSlice';
import Editor from 'react-simple-code-editor';

import { 
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Scale, 
    X, 
    Code2, 
    Compass,
    Save
} from 'lucide-react';
import { cn } from "@/lib/utils";

export const AgentRulesDialog: React.FC = () => {
    const [open, setOpen] = useState(false);
    const dispatch = useDispatch();
    const agentRules = useSelector((state: DataFormulatorState) => state.agentRules);

    // Local state for editing
    const [codingRules, setCodingRules] = useState(agentRules.coding);
    const [explorationRules, setExplorationRules] = useState(agentRules.exploration);

    // Placeholder content
    const codingPlaceholder = `Example Rules:

## Computation 
- ROI (return on investment) should be computed as (revenue - cost) / cost.
- When compute moving average for date field, the window size should be 7.
- When performing forecasting, by default use linear models.

## Coding
- When a string column contains placeholder '-' for missing values, convert them to ''.
- Date should all be formated as 'YYYY-MM-DD'.
`;

    const explorationPlaceholder = `Example Rules:

## Simpicity
- Keep the questions simple and concise, do not overcomplicate the exploration.
    
## Question Generation
- When you see outliers in the data, generate a question to investigate the outliers.

## Domain Knowledge
- When exploring large product dataset, include questions about top 20 based on different criteria.
`;

    // Update local state when dialog opens
    useEffect(() => {
        if (open) {
            setCodingRules(agentRules.coding);
            setExplorationRules(agentRules.exploration);
        }
    }, [open, agentRules]);

    const handleSaveCoding = () => {
        dispatch(dfActions.setAgentRules({
            coding: codingRules,
            exploration: agentRules.exploration
        }));
    };

    const handleSaveExploration = () => {
        dispatch(dfActions.setAgentRules({
            coding: agentRules.coding,
            exploration: explorationRules
        }));
    };

    const handleClose = () => {
        // Reset to original values
        setCodingRules(agentRules.coding);
        setExplorationRules(agentRules.exploration);
        setOpen(false);
    };

    // Check if there are changes for each tab
    const hasCodingChanges = codingRules !== agentRules.coding;
    const hasExplorationChanges = explorationRules !== agentRules.exploration;

    // Check if any rules are set
    const ruleCount = Number(agentRules.coding && agentRules.coding.trim().length > 0) + 
                        Number(agentRules.exploration && agentRules.exploration.trim().length > 0);

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
                className="gap-2 h-8 text-foreground/80 hover:text-foreground relative"
            >
                <Scale className="h-4 w-4" />
                Agent Rules
                {ruleCount > 0 && (
                    <Badge 
                        variant="secondary" 
                        className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-primary/10 text-primary"
                    >
                        {ruleCount}
                    </Badge>
                )}
            </Button>
            <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
                <DialogContent className="max-w-3xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Scale className="h-5 w-5 text-primary" />
                            Agent Rules
                        </DialogTitle>
                        <DialogDescription>
                            Configure rules to guide AI agents when generating code and exploring data
                        </DialogDescription>
                    </DialogHeader>
                    
                    <ScrollArea className="max-h-[65vh] pr-4">
                        <div className="space-y-6">
                            {/* Coding Agent Rules Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-primary/10">
                                        <Code2 className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-primary">Coding Rules</h3>
                                        <p className="text-xs text-muted-foreground">
                                            Rules that guide AI agents when generating code to transform data and recommend visualizations.
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="border border-primary/30 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 hover:border-primary/50">
                                    <Editor
                                        value={codingRules}
                                        onValueChange={(code) => setCodingRules(code)}
                                        highlight={(code) => code}
                                        padding={16}
                                        placeholder={codingPlaceholder}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Tab' && !codingRules) {
                                                e.preventDefault();
                                                setCodingRules(codingPlaceholder);
                                            }
                                        }}
                                        style={{
                                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                            fontSize: 11,
                                            lineHeight: 1.4,
                                            minHeight: 160,
                                            whiteSpace: 'pre-wrap',
                                            outline: 'none',
                                            resize: 'none',
                                            background: 'hsl(var(--muted)/0.3)',
                                        }}
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Exploration Agent Rules Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-secondary">
                                        <Compass className="h-4 w-4 text-secondary-foreground" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-secondary-foreground">Exploration Rules</h3>
                                        <p className="text-xs text-muted-foreground">
                                            Rules that guide AI agents when exploring datasets, generating questions, and discovering insights.
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="border border-secondary/50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 hover:border-secondary/70">
                                    <Editor
                                        value={explorationRules}
                                        onValueChange={(code) => setExplorationRules(code)}
                                        highlight={(code) => code}
                                        padding={16}
                                        placeholder={explorationPlaceholder}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Tab' && !explorationRules) {
                                                e.preventDefault();
                                                setExplorationRules(explorationPlaceholder);
                                            }
                                        }}
                                        style={{
                                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                            fontSize: 11,
                                            lineHeight: 1.4,
                                            minHeight: 160,
                                            whiteSpace: 'pre-wrap',
                                            outline: 'none',
                                            resize: 'none',
                                            background: 'hsl(var(--muted)/0.3)',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Save Buttons */}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!hasCodingChanges}
                                    onClick={handleSaveCoding}
                                    className="gap-2"
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    Save Coding Rules
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={!hasExplorationChanges}
                                    onClick={handleSaveExploration}
                                    className="gap-2"
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    Save Exploration Rules
                                </Button>
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
};
