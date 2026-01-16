
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FC } from 'react'
import { useDrag } from 'react-dnd'

import '../scss/ConceptShelf.scss';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface OperatorCardProp {
    operator: string
}

export const OperatorCard: FC<OperatorCardProp> = function OperatorCard({ operator }) {
    // concept cards are draggable cards that can be dropped into encoding shelf

    const [{ isDragging }, drag] = useDrag(() => ({
        type: "operator-card",
        item: { type: 'operator-card', operator, source: "conceptShelf" },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
            handlerId: monitor.getHandlerId(),
        }),
    }));

    const cardComponent = (
        <Card 
            className={cn(
                "min-w-[80px] w-[calc(50%-6px)] ml-[3px] border-hidden bg-secondary",
                "data-field-list-item draggable-card",
                isDragging ? "opacity-40" : "opacity-100"
            )}
        >
            <div 
                ref={drag} 
                className={cn(
                    "bg-white/95 draggable-card-header draggable-card-inner",
                    isDragging ? "cursor-grabbing" : "cursor-grab"
                )}
            >
                <span 
                    className="draggable-card-title ml-1.5 text-xs h-6 w-full italic mb-1"
                >
                    {operator}
                </span>
            </div>
        </Card>
    )

    return cardComponent;
}
