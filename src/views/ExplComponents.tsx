// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { FC, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Lightbulb, Info } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Helper function to render text with LaTeX math expressions
const renderWithMath = (text: string) => {

    const parts: Array<{ type: 'text' | 'inline' | 'block', content: string }> = [];
    let currentIndex = 0;
    let currentText = '';
    
    while (currentIndex < text.length) {
        // Check for block math \[ ... \]
        if (text.slice(currentIndex, currentIndex + 2) === '\\[') {
            // Save any accumulated text
            if (currentText) {
                parts.push({ type: 'text', content: currentText });
                currentText = '';
            }
            
            // Find the closing \]
            let blockEnd = currentIndex + 2;
            let braceCount = 0;
            while (blockEnd < text.length) {
                if (text.slice(blockEnd, blockEnd + 2) === '\\]') {
                    break;
                }
                if (text[blockEnd] === '{') braceCount++;
                if (text[blockEnd] === '}') braceCount--;
                blockEnd++;
            }
            
            if (blockEnd < text.length) {
                // Found complete block math
                const mathContent = text.slice(currentIndex + 2, blockEnd);
                parts.push({ type: 'block', content: mathContent });
                currentIndex = blockEnd + 2;
            } else {
                // No closing bracket found, treat as text
                currentText += text[currentIndex];
                currentIndex++;
            }
        }
        // Check for inline math \( ... \)
        else if (text.slice(currentIndex, currentIndex + 2) === '\\(') {
            // Save any accumulated text
            if (currentText) {
                parts.push({ type: 'text', content: currentText });
                currentText = '';
            }
            
            // Find the closing \)
            let inlineEnd = currentIndex + 2;
            let braceCount = 0;
            while (inlineEnd < text.length) {
                if (text.slice(inlineEnd, inlineEnd + 2) === '\\)') {
                    break;
                }
                if (text[inlineEnd] === '{') braceCount++;
                if (text[inlineEnd] === '}') braceCount--;
                inlineEnd++;
            }
            
            if (inlineEnd < text.length) {
                // Found complete inline math
                const mathContent = text.slice(currentIndex + 2, inlineEnd);
                parts.push({ type: 'inline', content: mathContent });
                currentIndex = inlineEnd + 2;
            } else {
                // No closing bracket found, treat as text
                currentText += text[currentIndex];
                currentIndex++;
            }
        }
        // Regular character
        else {
            currentText += text[currentIndex];
            currentIndex++;
        }
    }
    
    // Add any remaining text
    if (currentText) {
        parts.push({ type: 'text', content: currentText });
    }
    
    return parts.map((part, index) => {
        if (part.type === 'inline') {
            try {
                return <InlineMath key={index} math={part.content} />;
            } catch (error) {
                return <span key={index}>{`\\(${part.content}\\)`}</span>;
            }
        } else if (part.type === 'block') {
            try {
                return <BlockMath key={index} math={part.content} />;
            } catch (error) {
                return <span key={index}>{`\\[${part.content}\\]`}</span>;
            }
        } else {
            return <span key={index}>{part.content}</span>;
        }
    });
};

// Concept explanation card component using Tailwind
const ConceptExplanationCard: FC<{ secondary: boolean; children: React.ReactNode }> = ({ 
    secondary, 
    children 
}) => (
    <div 
        className={cn(
            "min-w-[360px] max-w-[480px] m-1 rounded-md border border-border/20",
            "shadow-sm transition-all duration-200 ease-in-out bg-card/90",
            "hover:shadow-md hover:-translate-y-0.5",
            secondary ? "hover:border-secondary" : "hover:border-primary"
        )}
    >
        {children}
    </div>
);

// Concept name component
const ConceptName: FC<{ secondary: boolean; children: React.ReactNode }> = ({ 
    secondary, 
    children 
}) => (
    <div 
        className={cn(
            "text-xs font-semibold mb-0.5 flex items-center gap-1",
            secondary ? "text-secondary" : "text-primary"
        )}
    >
        {children}
    </div>
);

// Concept explanation component
const ConceptExplanation: FC<{ children: React.ReactNode }> = ({ children }) => (
    <div 
        className={cn(
            "text-[11px] leading-snug overflow-auto text-foreground italic",
            "[&_.katex]:text-xs [&_.katex]:leading-tight",
            "[&_.katex-display]:my-1"
        )}
    >
        {children}
    </div>
);

export interface ConceptExplanationItem {
    field: string;
    explanation: string;
}

export interface ConceptExplCardsProps {
    concepts: ConceptExplanationItem[];
    title?: string;
    maxCards?: number;
}

export const ConceptExplCards: FC<ConceptExplCardsProps> = ({ 
    concepts, 
    maxCards = 8 
}) => {
    const [expanded, setExpanded] = useState(false);

    if (!concepts || concepts.length === 0) {
        return null;
    }

    const displayConcepts = expanded ? concepts : concepts.slice(0, maxCards);
    const hasMoreConcepts = concepts.length > maxCards;


    return (
        <div className="relative flex justify-center">
            {/* Concepts Grid */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-1 overflow-hidden">
                {displayConcepts.map((concept, index) => {
                    let secondary = concept.field == "Statistical Analysis";
                    return (
                        <ConceptExplanationCard key={`${concept.field}-${index}`} secondary={secondary}>
                            <div className="p-1.5">
                                <ConceptName secondary={secondary}>
                                    {concept.field}
                                </ConceptName>
                                <ConceptExplanation>
                                    {renderWithMath(concept.explanation)}
                                </ConceptExplanation>
                            </div>
                        </ConceptExplanationCard>
                    );
                })}
            </div>

            {/* Show More/Less Button */}
            {hasMoreConcepts && (
                <div className="flex justify-center mt-1 pt-1 border-t border-border">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setExpanded(!expanded)}
                                    className="text-[10px] text-muted-foreground hover:bg-accent"
                                >
                                    <span className="text-xs">
                                        {expanded 
                                            ? `Show first ${maxCards} concepts` 
                                            : `Show all ${concepts.length} concepts`
                                        }
                                    </span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {expanded ? "Show fewer concepts" : "Show all concepts"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
        </div>
    );
};

// Helper function to extract concept explanations from table derivation
export const extractConceptExplanations = (table: any): ConceptExplanationItem[] => {
    if (!table?.derive?.explanation?.concepts) {
        return [];
    }

    return table.derive.explanation.concepts.map((concept: any) => ({
        field: concept.field,
        explanation: concept.explanation,
    }));
}; 


// Shared component for data transformation cards
export const CodeExplanationCard: FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    transformationIndicatorText: string;
}> = ({ title, icon, children, transformationIndicatorText }) => (
    <div 
        className={cn(
            "min-w-[280px] max-w-[1200px] flex flex-grow m-0 rounded-lg",
            "border border-border shadow-sm transition-all duration-200 ease-in-out",
            "hover:shadow-md hover:border-primary"
        )}
    >
        <div className="flex flex-col flex-grow p-0 overflow-auto">
            <p className="text-sm m-3 font-medium text-foreground flex items-center gap-1">
                {icon}
                {title} ({transformationIndicatorText})
            </p>
            <div 
                className={cn(
                    "flex flex-row items-start flex-auto p-3",
                    "bg-background border-t border-border rounded-b-lg"
                )}
            >
                {children}
            </div>
        </div>
    </div>
);
