// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Play, ArrowRight } from 'lucide-react';

// Example session data for pre-built sessions
export interface ExampleSession {
    id: string;
    title: string;
    description: string;
    previewImage: string;
    dataFile: string;
}

export const exampleSessions: ExampleSession[] = [
    {
        id: 'gas-prices',
        title: 'Gas Prices',
        description: 'Weekly gas prices across different grades and formulations',
        previewImage: '/gas_prices-thumbnail.webp',
        dataFile: '/df_gas_prices.json',
    },
    {
        id: 'global-energy',
        title: 'Global Energy',
        description: 'Explore global energy consumption and CO2 emissions data',
        previewImage: '/global_energy-thumbnail.webp',
        dataFile: '/df_global_energy.json',
    },
    {
        id: 'movies',
        title: 'Movies',
        description: 'Analyze movie performance, budgets, and ratings data',
        previewImage: '/movies-thumbnail.webp',
        dataFile: '/df_movies.json',
    },
    {
        id: 'unemployment',
        title: 'Unemployment',
        description: 'Unemployment rates across different industries over time',
        previewImage: '/unemployment-thumbnail.webp',
        dataFile: '/df_unemployment.json',
    }
];

// Premium Session card component
export const ExampleSessionCard: React.FC<{
    session: ExampleSession;
    theme: any;
    onClick: () => void;
    disabled?: boolean;
}> = ({ session, theme, onClick, disabled }) => {
    return (
        <Card 
            className={cn(
                "group cursor-pointer overflow-hidden bg-card border border-border",
                "transition-all duration-200",
                "hover:border-foreground/20 hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={disabled ? undefined : onClick}
        >
            {/* Clean Image Container */}
            <div className="relative h-28 overflow-hidden bg-muted">
                {/* Subtle Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent z-10" />
                
                {/* Image */}
                <img
                    src={session.previewImage}
                    alt={session.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center">
                        <Play className="h-4 w-4 text-background ml-0.5" />
                    </div>
                </div>
            </div>

            {/* Content */}
            <CardContent className="p-4">
                <h3 className="font-semibold text-sm text-foreground mb-1.5">
                    {session.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {session.description}
                </p>
            </CardContent>
        </Card>
    );
};
