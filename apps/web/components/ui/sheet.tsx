"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Z_MODAL, Z_SHEET_STACKED } from "@/lib/z-layers"

/** Radix portaled pickers; modal Dialog/Sheet treats those clicks as "outside" otherwise. */
function pointerEventTargetIsInsideRadixPortaledPicker(event: {
  target: EventTarget | null
  detail?: { originalEvent?: Event }
}): boolean {
  const candidates = [event.target, event.detail?.originalEvent?.target]
  return candidates.some((t) => {
    if (!(t instanceof Element)) return false
    return !!(
      t.closest("[data-radix-select-viewport]") ||
      t.closest("[data-radix-popper-content-wrapper]")
    )
  })
}

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, style, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-[1200] bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    style={{ zIndex: Z_MODAL, ...style }}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-[1200] gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-full border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-full border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** When true, no dimming overlay is rendered (use when opening over another dialog/sheet). */
  hideOverlay?: boolean
}

// Helper function to recursively check if children contain a Title
const hasTitleInChildren = (children: React.ReactNode): boolean => {
  return React.Children.toArray(children).some((child) => {
    if (!React.isValidElement(child)) return false

    // Check if it's a SheetPrimitive.Title
    if (child.type === SheetPrimitive.Title) return true

    // Check if it's a component with the Title displayName (e.g., SheetTitle wrapper)
    const childType = child.type
    if (childType !== null && childType !== undefined && typeof childType === "object") {
      const typeObj = childType as Record<string, unknown>
      if ("displayName" in typeObj) {
        const displayName = typeObj.displayName
        if (displayName === SheetPrimitive.Title.displayName) {
          return true
        }
      }
    }

    // Check if it has children and recursively search
    const props = child.props as { children?: React.ReactNode }
    if (props?.children) {
      return hasTitleInChildren(props.children)
    }

    return false
  })
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, hideOverlay, onPointerDownOutside, onInteractOutside, style, ...props }, ref) => {
  // Check if children contains a Title
  const hasTitle = hasTitleInChildren(children)

  return (
    <SheetPortal>
      {!hideOverlay && <SheetOverlay />}
      <SheetPrimitive.Content
        ref={ref}
        className={cn(
          sheetVariants({ side }),
          hideOverlay && "z-[1400]",
          className,
          // Keep panel fixed: a trailing `relative` in className would override `fixed` from variants.
          "!fixed"
        )}
        {...props}
        style={{
          zIndex: hideOverlay ? Z_SHEET_STACKED : Z_MODAL,
          ...style,
        }}
        onPointerDownOutside={(event) => {
          if (pointerEventTargetIsInsideRadixPortaledPicker(event)) {
            event.preventDefault()
          }
          onPointerDownOutside?.(event)
        }}
        onInteractOutside={(event) => {
          if (pointerEventTargetIsInsideRadixPortaledPicker(event)) {
            event.preventDefault()
          }
          onInteractOutside?.(event)
        }}
      >
        {!hasTitle && (
          <SheetPrimitive.Title className="sr-only">Sheet</SheetPrimitive.Title>
        )}
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 z-[100] rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
