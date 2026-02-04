"use client";

import { cn } from "@/lib/frontend/utils";
import { ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./button";

export interface TabItem {
  label: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  count?: number;
  attention?: boolean;
}

export interface ArrowNavigationTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
  tabClassName?: string;
  arrowClassName?: string;
  showLabels?: boolean;
  showCounts?: boolean;
  scrollAmount?: number;
}

export function ArrowNavigationTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
  tabClassName,
  arrowClassName,
  showLabels = true,
  showCounts = true,
  scrollAmount = 200,
}: ArrowNavigationTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position and update arrow states
  const updateScrollState = () => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
  };

  // Update scroll state on mount and when tabs change
  useEffect(() => {
    updateScrollState();
  }, [tabs]);

  // Add scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", updateScrollState);
    return () => container.removeEventListener("scroll", updateScrollState);
  }, []);

  const goLeft = () => {
    if (!scrollContainerRef.current || !canScrollLeft) return;

    scrollContainerRef.current.scrollBy({
      left: -scrollAmount,
      behavior: "smooth",
    });
  };

  const goRight = () => {
    if (!scrollContainerRef.current || !canScrollRight) return;

    scrollContainerRef.current.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });
  };

  // Ensure active tab is visible
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const activeTabIndex = tabs.findIndex((tab) => tab.value === activeTab);
    if (activeTabIndex === -1) return;

    const container = scrollContainerRef.current;
    const tabElements = container.children;
    const activeTabElement = tabElements[activeTabIndex] as HTMLElement;

    if (activeTabElement) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTabElement.getBoundingClientRect();

      // Check if tab is fully visible
      const isVisible =
        tabRect.left >= containerRect.left &&
        tabRect.right <= containerRect.right;

      if (!isVisible) {
        activeTabElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeTab, tabs]);

  return (
    <div
      className={cn(
        "flex items-center gap-1 w-full relative overflow-hidden",
        className
      )}
    >
      {/* Left Arrow */}
      <Button
        variant="outline"
        size="sm"
        onClick={goLeft}
        disabled={!canScrollLeft}
        className={cn(
          "h-8 w-8 p-0 shrink-0 sticky left-0",
          !canScrollLeft && "opacity-50 cursor-not-allowed",
          arrowClassName
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Tabs Container */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex bg-muted rounded-lg p-1 overflow-x-auto scroll-smooth gap-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = tab.value === activeTab;
            const isAttention = tab.count && tab.count > 0 && tab.attention;
            return (
              <button
                key={tab.value}
                onClick={() => onTabChange(tab.value)}
                title={tab.description || tab.label}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all shrink-0 whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                  !isActive && isAttention && "bg-destructive text-destructive-foreground hover:bg-destructive/80 hover:text-destructive-foreground",
                  isActive && isAttention && "bg-primary text-primary-foreground shadow-sm",
                  isAttention && "animate-attention-blink",
                  tabClassName
                )}
              >
                <IconComponent className="w-4 h-4 shrink-0" />
                {showLabels && (
                  <span className="hidden sm:inline">{tab.label}</span>
                )}
                {showCounts && tab.count !== undefined && (
                  <span className={cn(
                    "inline-block bg-primary/10 text-primary text-xs rounded-full px-1.5 py-0.5 font-medium min-w-[1.5rem] text-center",
                    !isActive && isAttention && "bg-accent text-destructive",
                    isActive && "text-primary bg-background"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Arrow */}
      <Button
        variant="outline"
        size="sm"
        onClick={goRight}
        disabled={!canScrollRight}
        className={cn(
          "h-8 w-8 p-0 shrink-0",
          !canScrollRight && "opacity-50 cursor-not-allowed",
          arrowClassName
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
