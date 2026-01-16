import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface RotatingTextBlockProps {
    texts: string[];
    rotationInterval?: number;
    transitionDuration?: number;
    className?: string;
}

export const RotatingTextBlock: React.FC<RotatingTextBlockProps> = ({
    texts,
    rotationInterval = 3000,
    transitionDuration = 500,
    className
}) => {
    const [currentTextIndex, setCurrentTextIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Effect for rotating text with carousel transition
    useEffect(() => {
        const interval = setInterval(() => {
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
                setIsTransitioning(false);
            }, transitionDuration);
        }, rotationInterval);

        return () => clearInterval(interval);
    }, [texts.length, rotationInterval, transitionDuration]);

    return (
        <span
            className={cn(
                "inline relative font-medium transition-opacity",
                isTransitioning ? "opacity-0" : "opacity-100",
                className
            )}
            style={{ transitionDuration: `${transitionDuration}ms` }}
        >
            {texts[currentTextIndex]}
        </span>
    );
};
