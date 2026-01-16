// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { FC, useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { 
    ChevronLeft, 
    ChevronRight, 
    Github, 
    Youtube, 
    Bot, 
    Sparkles, 
    Database, 
    LineChart,
    MessageSquare,
    Play,
    ArrowRight,
    Zap,
    Shield,
    Code
} from 'lucide-react';

import dfLogo from '../assets/df-logo.png';
import { toolName } from "../app/App";
import { DataFormulatorState } from "../app/dfSlice";


interface Feature {
    title: string;
    description: string;
    media: string;
    mediaType: 'image' | 'video';
    icon: React.ReactNode;
}

const features: Feature[] = [
    {
        title: "Load Any Data",
        description: "Load structured data, connect to databases, or let AI extract and clean data from screenshots and text.",
        media: "/feature-extract-data.mp4",
        mediaType: "video",
        icon: <Database className="h-6 w-6" />
    },
    {
        title: "Agent Mode",
        description: "Hands-off exploration. Let AI agents automatically discover insights and create visualizations.",
        media: "/feature-agent-mode.mp4",
        mediaType: "video",
        icon: <Bot className="h-6 w-6" />
    },
    {
        title: "Interactive Control",
        description: "Use natural language and UI interactions to precisely design charts. Backtrack and explore branches.",
        media: "/feature-interactive-control.mp4",
        mediaType: "video",
        icon: <MessageSquare className="h-6 w-6" />
    },
    {
        title: "Verify & Share",
        description: "Inspect data, formulas, and code. Create shareable reports grounded in your exploration.",
        media: "/feature-generate-report.mp4",
        mediaType: "video",
        icon: <LineChart className="h-6 w-6" />
    }
];

const screenshots: {url: string, description: string}[] = [
    {url: "/data-formulator-screenshot-v0.5.webp", description: "Explore consumer price trends from 2005 to 2025"},
    {url: "/screenshot-movies-report.webp", description: "Report: Top directors by their revenue"},
    {url: "/screenshot-renewable-energy.webp", description: "Renewable energy percentage by country"},
    {url: '/screenshot-unemployment.webp', description: 'Report: Unemployment rate affected by 2008 financial crisis'},
    {url: '/screenshot-claude-performance.webp', description: 'Compare Claude models\' performance on different tasks'},
];

const benefits = [
    { icon: <Zap className="h-5 w-5" />, title: "Lightning Fast", description: "Go from data to insights in seconds" },
    { icon: <Shield className="h-5 w-5" />, title: "Privacy First", description: "Your data stays in your browser" },
    { icon: <Code className="h-5 w-5" />, title: "Open Source", description: "MIT licensed, fully customizable" },
];

export const About: FC<{}> = function About({ }) {
    const [currentFeature, setCurrentFeature] = useState(0);
    const [currentScreenshot, setCurrentScreenshot] = useState(0);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const videoDurationsRef = useRef<Map<string, number>>(new Map());
    const [isHovering, setIsHovering] = useState(false);

    const handlePrevious = () => {
        setCurrentFeature((prev) => (prev === 0 ? features.length - 1 : prev - 1));
    };

    const handleNext = () => {
        setCurrentFeature((prev) => (prev === features.length - 1 ? 0 : prev + 1));
    };

    // Auto-advance features based on video duration (pause on hover)
    useEffect(() => {
        if (isHovering) return;
        
        const currentMedia = features[currentFeature].media;
        const isVideo = features[currentFeature].mediaType === 'video';
        
        let duration = 10000;
        
        if (isVideo && videoDurationsRef.current.has(currentMedia)) {
            duration = videoDurationsRef.current.get(currentMedia)! * 1000 + 3000;
        }

        const timeoutId = setTimeout(() => {
            setCurrentFeature((prev) => (prev + 1) % features.length);
        }, duration);

        return () => clearTimeout(timeoutId);
    }, [currentFeature, isHovering]);

    // Auto-advance screenshots
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentScreenshot((prev) => (prev + 1) % screenshots.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Preload adjacent carousel items
    useEffect(() => {
        const preloadMedia = (index: number) => {
            const feature = features[index];
            if (feature.mediaType === 'video') {
                const video = document.createElement('video');
                video.src = feature.media;
                video.preload = 'metadata';
            } else {
                const img = new Image();
                img.src = feature.media;
            }
        };

        const nextIndex = (currentFeature + 1) % features.length;
        const prevIndex = currentFeature === 0 ? features.length - 1 : currentFeature - 1;
        
        preloadMedia(nextIndex);
        preloadMedia(prevIndex);

        const nextScreenshot = (currentScreenshot + 1) % screenshots.length;
        const img = new Image();
        img.src = screenshots[nextScreenshot].url;
    }, [currentFeature, currentScreenshot]);

    const serverConfig = useSelector((state: DataFormulatorState) => state.serverConfig);

    return (
        <div className="flex flex-col h-full overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5">
            {/* Hero Section */}
            <section className="relative px-6 py-20 lg:py-32 overflow-hidden">
                {/* Animated background elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-primary/5 to-transparent rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-6xl mx-auto text-center">
                    {/* Badge */}
                    <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium">
                        <Sparkles className="h-3.5 w-3.5 mr-2" />
                        Powered by AI Agents
                    </Badge>

                    {/* Main heading */}
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
                        {toolName}
                    </h1>

                    {/* Subtitle */}
                    <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                        Transform your data into stunning visualizations with AI-powered exploration and natural language interactions.
                    </p>

                    {/* CTA Buttons */}
                    {!serverConfig.PROJECT_FRONT_PAGE ? (
                        <div className="flex justify-center gap-4 mb-8">
                            <Button size="lg" className="gap-2 text-base px-8 shadow-lg hover:shadow-xl transition-all" asChild>
                                <a href="/app">
                                    <Bot className="h-5 w-5" />
                                    Start Exploring
                                    <ArrowRight className="h-4 w-4 ml-1" />
                                </a>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex flex-wrap justify-center gap-4">
                                <Button size="lg" className="gap-2 text-base px-8 shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-primary to-primary/80" asChild>
                                    <a href="/app">
                                        <Play className="h-4 w-4" />
                                        Try Online Demo
                                    </a>
                                </Button>
                                <Button size="lg" variant="outline" className="gap-2 text-base px-6" asChild>
                                    <a href="https://pypi.org/project/data-formulator/" target="_blank" rel="noopener noreferrer">
                                        <img src="/pip-logo.svg" alt="" className="w-5 h-5" />
                                        Install Locally
                                    </a>
                                </Button>
                            </div>
                            <div className="flex gap-3 mt-2">
                                <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground" asChild>
                                    <a href="https://github.com/microsoft/data-formulator" target="_blank" rel="noopener noreferrer">
                                        <Github className="h-4 w-4" />
                                        GitHub
                                    </a>
                                </Button>
                                <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground" asChild>
                                    <a href="https://www.youtube.com/watch?v=GfTE2FLyMrs" target="_blank" rel="noopener noreferrer">
                                        <Youtube className="h-4 w-4 text-red-500" />
                                        What's New
                                    </a>
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                ✨ Install locally for the full experience
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Benefits Strip */}
            <section className="py-8 border-y border-border/50 bg-muted/30">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16">
                        {benefits.map((benefit, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    {benefit.icon}
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{benefit.title}</p>
                                    <p className="text-xs text-muted-foreground">{benefit.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
                        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                            Everything you need to turn data into actionable insights
                        </p>
                    </div>

                    {/* Feature Cards Grid */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                        {features.map((feature, index) => (
                            <Card 
                                key={index}
                                onClick={() => setCurrentFeature(index)}
                                className={cn(
                                    "cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
                                    currentFeature === index 
                                        ? "border-primary shadow-lg ring-2 ring-primary/20" 
                                        : "hover:border-primary/50"
                                )}
                            >
                                <CardContent className="p-6">
                                    <div className={cn(
                                        "p-3 rounded-xl w-fit mb-4 transition-colors",
                                        currentFeature === index 
                                            ? "bg-primary text-primary-foreground" 
                                            : "bg-primary/10 text-primary"
                                    )}>
                                        {feature.icon}
                                    </div>
                                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {feature.description}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Feature Demo */}
                    <div 
                        className="relative rounded-2xl overflow-hidden border shadow-2xl bg-gradient-to-br from-muted/50 to-background"
                        onMouseEnter={() => setIsHovering(true)}
                        onMouseLeave={() => setIsHovering(false)}
                    >
                        <div className="flex items-center gap-4 p-4 border-b bg-muted/50">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-400" />
                                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                <div className="w-3 h-3 rounded-full bg-green-400" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">
                                {features[currentFeature].title}
                            </span>
                        </div>
                        
                        <div className="relative aspect-video">
                            {/* Navigation Arrows */}
                            <Button 
                                variant="secondary"
                                size="icon"
                                onClick={handlePrevious}
                                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity shadow-lg"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <Button 
                                variant="secondary"
                                size="icon"
                                onClick={handleNext}
                                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity shadow-lg"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Button>

                            {features[currentFeature].mediaType === 'video' ? (
                                <video
                                    key={features[currentFeature].media}
                                    src={features[currentFeature].media}
                                    ref={videoRef}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    preload="metadata"
                                    onLoadedMetadata={(e) => {
                                        const video = e.currentTarget as HTMLVideoElement;
                                        if (video.duration && !isNaN(video.duration)) {
                                            videoDurationsRef.current.set(
                                                features[currentFeature].media,
                                                video.duration
                                            );
                                        }
                                    }}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <img
                                    src={features[currentFeature].media}
                                    alt={features[currentFeature].title}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>

                        {/* Progress indicators */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                            {features.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentFeature(index)}
                                    className={cn(
                                        "w-8 h-1.5 rounded-full transition-all",
                                        index === currentFeature 
                                            ? "bg-white w-12" 
                                            : "bg-white/40 hover:bg-white/60"
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Screenshots Gallery */}
            <section className="py-20 px-6 bg-muted/30">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">See It In Action</h2>
                        <p className="text-muted-foreground text-lg">
                            Real examples of data exploration and visualization
                        </p>
                    </div>

                    <div className="relative">
                        <div 
                            key={currentScreenshot}
                            onClick={() => setCurrentScreenshot((currentScreenshot + 1) % screenshots.length)}
                            className="cursor-pointer group"
                        >
                            <div className="rounded-2xl overflow-hidden shadow-2xl border transition-all duration-500 hover:shadow-3xl">
                                <img 
                                    className="w-full h-auto"
                                    alt={screenshots[currentScreenshot].description} 
                                    src={screenshots[currentScreenshot].url}
                                    loading="lazy"
                                />
                            </div>
                            <div className="mt-6 text-center">
                                <p className="text-lg font-medium text-foreground/80">
                                    {screenshots[currentScreenshot].description}
                                </p>
                            </div>
                        </div>

                        {/* Screenshot Indicators */}
                        <div className="flex justify-center gap-2 mt-8">
                            {screenshots.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentScreenshot(index)}
                                    className={cn(
                                        "w-2 h-2 rounded-full transition-all",
                                        index === currentScreenshot 
                                            ? "bg-primary w-8" 
                                            : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Data Privacy Section */}
            <section className="py-16 px-6">
                <div className="max-w-3xl mx-auto">
                    <Card className="border-primary/20">
                        <CardContent className="p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <Shield className="h-6 w-6 text-primary" />
                                <h3 className="text-xl font-semibold">Your Data, Your Control</h3>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
                                <div className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-foreground">Browser Storage</p>
                                        <p>Data stays in your browser's local storage</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-foreground">Local Processing</p>
                                        <p>Python runs on your machine (local install)</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-foreground">LLM Endpoints</p>
                                        <p>Small samples sent for AI features only</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-foreground">Open Source</p>
                                        <p>MIT licensed, audit the code yourself</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Footer */}
            <footer className="mt-auto py-8 px-6 border-t bg-muted/30">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                        Research Prototype from Microsoft Research · © {new Date().getFullYear()}
                    </p>
                    <div className="flex items-center gap-4">
                        <Button variant="link" size="sm" className="text-muted-foreground h-auto p-0" asChild>
                            <a href="https://www.microsoft.com/en-us/privacy/privacystatement" target="_blank" rel="noopener noreferrer">
                                Privacy
                            </a>
                        </Button>
                        <Separator orientation="vertical" className="h-4" />
                        <Button variant="link" size="sm" className="text-muted-foreground h-auto p-0" asChild>
                            <a href="https://www.microsoft.com/en-us/legal/intellectualproperty/copyright" target="_blank" rel="noopener noreferrer">
                                Terms
                            </a>
                        </Button>
                        <Separator orientation="vertical" className="h-4" />
                        <Button variant="link" size="sm" className="text-muted-foreground h-auto p-0" asChild>
                            <a href="https://github.com/microsoft/data-formulator/issues" target="_blank" rel="noopener noreferrer">
                                Contact
                            </a>
                        </Button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
