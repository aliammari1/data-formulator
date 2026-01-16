// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FC, useState } from 'react'
import { useDrag } from 'react-dnd'
import { useSelector, useDispatch } from 'react-redux'

import '../scss/ConceptShelf.scss';

import 'prismjs/components/prism-python' // Language
import 'prismjs/themes/prism.css'; //Example style, you can use another

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import { Trash2, ArrowRight } from 'lucide-react';

import { FieldItem } from '../components/ComponentType';

import React from 'react';
import { DataFormulatorState, dfActions } from '../app/dfSlice';

import { getIconFromType } from './ViewUtils';

import { cn } from '@/lib/utils';

export interface ConceptCardProps {
    field: FieldItem,
    className?: string
}

export const ConceptCard: FC<ConceptCardProps> = function ConceptCard({ field, className }) {
    // concept cards are draggable cards that can be dropped into encoding shelf

    const tables = useSelector((state: DataFormulatorState) => state.tables);
    let focusedTableId = useSelector((state: DataFormulatorState) => state.focusedTableId);
    
    let focusedTable = tables.find(t => t.id == focusedTableId);

    const [editMode, setEditMode] = useState(field.name == "" ? true : false);

    const dispatch = useDispatch();
    let handleDeleteConcept = (conceptID: string) => dispatch(dfActions.deleteConceptItemByID(conceptID));

    const [{ isDragging }, drag] = useDrag(() => ({
        type: "concept-card",
        item: { type: 'concept-card', fieldID: field.id, source: "conceptShelf" },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
            handlerId: monitor.getHandlerId(),
        }),
    }));

    let [isLoading, setIsLoading] = useState(false);

    const cursorStyle = isDragging ? "cursor-grabbing" : "cursor-grab";

    let deleteOption = !(field.source == "original") && (
        <Button
            key="delete-icon-button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-primary hover:text-primary"
            aria-label="Delete"
            onClick={() => { handleDeleteConcept(field.id); }}
        >
            <Trash2 className="h-3 w-3" />
        </Button>
    );

    let cardHeaderOptions = [
        deleteOption,
    ]

    let typeIcon = (
        <span className="text-inherit flex items-center align-middle">
            {getIconFromType(focusedTable?.metadata[field.name]?.type)}
        </span>
    )

    let fieldNameEntry = field.name != "" ? (
        <span className="text-inherit ml-[3px] whitespace-nowrap overflow-hidden text-ellipsis shrink">
            {field.name}
        </span>
    ) : (
        <span className="text-xs ml-[3px] text-gray-500 italic">new concept</span>
    );

    // Background color based on field source
    let bgColorClass = 'bg-primary';
    if (field.source == "original") {
        bgColorClass = 'bg-primary/70';
    } else if (field.source == "custom") {
        bgColorClass = 'bg-purple-500';
    } else if (field.source == "derived") {
        bgColorClass = 'bg-amber-500';
    }

    let draggleCardHeaderBgOverlay = 'bg-white/90';

    // Add subtle tint for non-focused fields
    if (focusedTable && !focusedTable.names.includes(field.name)) {
        draggleCardHeaderBgOverlay = 'bg-white';
    }

    let cardComponent = (
        <Card 
            className={cn(
                "min-w-[60px] relative ml-[3px] data-field-list-item draggable-card",
                bgColorClass,
                isDragging ? "opacity-30" : "opacity-100",
                editMode ? "shadow-md" : "",
                className
            )}
            style={{ border: 'hidden', fontStyle: 'inherit' }}
        >
            {isLoading && (
                <div className="absolute z-20 h-full w-full flex items-center justify-center">
                    <Progress value={50} className="w-full h-full opacity-20" />
                </div>
            )}
            <div 
                ref={field.name ? drag : undefined} 
                className={cn(
                    cursorStyle,
                    draggleCardHeaderBgOverlay,
                    `draggable-card-header draggable-card-inner ${field.source}`
                )}
            >
                <span 
                    className="draggable-card-title text-foreground text-xs h-6 w-full flex items-center"
                >
                    {typeIcon}
                    {fieldNameEntry}
                    {focusedTable?.metadata[field.name]?.semanticType && (
                        <span className="text-[10px] text-muted-foreground ml-1.5 italic whitespace-nowrap flex items-center">
                            <ArrowRight className="h-3 w-3" /> {focusedTable?.metadata[field.name].semanticType}
                        </span>
                    )}
                </span>
                
                <div className="absolute right-0 flex flex-row items-center">
                    <div className='draggable-card-action-button bg-white/95'>{cardHeaderOptions}</div>
                </div>
            </div>
        </Card>
    )

    return cardComponent;
}