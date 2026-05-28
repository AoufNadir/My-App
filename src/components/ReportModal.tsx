import React, { useRef, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from './ui/Modal';
import { Button } from './ui/Button';
import { ShareIcon } from './icons/ShareIcon';
import { DownloadCloudIcon } from './icons/DownloadCloudIcon';
declare const html2canvas: any;
type ReportModalProps = {
    isOpen: boolean;
    onClose: () => void;
    reportData: {
        html: string;
        filename: string;
    } | null;
};
function readTokenColor(tokenName: string): string | undefined {
    if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
        return undefined;
    }
    return window.getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim() || undefined;
}
export function ReportModal({ isOpen, onClose, reportData }: ReportModalProps) {
    const reportPrintRef = useRef<HTMLDivElement>(null);
    const [isSharing, setIsSharing] = useState(false);
    const canShare = typeof navigator.share === 'function';
    const handleShareImage = async () => {
        const element = reportPrintRef.current;
        if (!element || !reportData) {
            alert("خطأ: لم يتم العثور على التقرير.");
            return;
        }
        if (isSharing)
            return;
        setIsSharing(true);
        try {
            const exportSurfaceColor = readTokenColor('--color-surface');
            // Step 1: Capture the entire element into a single, high-quality canvas.
            const canvas = await html2canvas(element, {
                // Technical export configuration: fixed pixel ratio/background is required for html2canvas output fidelity.
                scale: 3,
                useCORS: true,
                backgroundColor: exportSurfaceColor,
                windowHeight: element.scrollHeight,
            });
            const totalHeight = canvas.height;
            const totalWidth = canvas.width;
            const scale = totalHeight / element.scrollHeight;
            // Step 2: Calculate intelligent break points to avoid cutting content.
            const breakPoints: number[] = [0];
            // Use A4 aspect ratio to estimate a reasonable page height for splitting.
            const MAX_PAGE_HEIGHT = totalWidth * 1.414; // A4 aspect ratio is sqrt(2)
            // Find all elements that are safe to break after (table rows, section headers, etc.)
            const breakableElements = Array.from(element.querySelectorAll('tr, .section-header, .details-grid'));
            // Get the scaled bottom position of each potential break point
            const elementBottoms = breakableElements.map((item: Element) => {
                const itemRect = item.getBoundingClientRect();
                const elementRect = element.getBoundingClientRect();
                const itemRelativeTop = itemRect.top - elementRect.top;
                return (itemRelativeTop + itemRect.height) * scale;
            });
            let lastBreak = 0;
            while (lastBreak < totalHeight) {
                // Find the furthest possible break point that fits within the max page height
                const potentialNextBreak = elementBottoms.filter(bottom => bottom > lastBreak && bottom <= lastBreak + MAX_PAGE_HEIGHT).pop();
                let nextBreak: number;
                if (potentialNextBreak) {
                    // We found a good spot to break within the page height limit
                    nextBreak = potentialNextBreak;
                }
                else {
                    // This branch handles cases where a single element is taller than MAX_PAGE_HEIGHT, or it's the last page.
                    // Find the very next element that is past the current break point.
                    const firstElementAfterBreak = elementBottoms.find(bottom => bottom > lastBreak);
                    if (firstElementAfterBreak) {
                        // Break after this tall/next element.
                        nextBreak = firstElementAfterBreak;
                    }
                    else {
                        // No more elements found, this must be the end of the content.
                        nextBreak = totalHeight;
                    }
                }
                // To avoid creating a tiny sliver for the last page, merge it if it's too small.
                if (totalHeight - nextBreak < 100 * scale) { // e.g., less than 100px
                    breakPoints.push(totalHeight);
                    break;
                }
                if (nextBreak > lastBreak) {
                    breakPoints.push(nextBreak);
                    lastBreak = nextBreak;
                }
                else {
                    // If we didn't advance, force break to end to avoid infinite loop
                    if (lastBreak !== totalHeight) {
                        breakPoints.push(totalHeight);
                    }
                    break;
                }
            }
            // Clean up the break points array
            const finalBreakPoints = [...new Set(breakPoints)].sort((a, b) => a - b);
            // Step 3: Slice the large canvas into page-sized canvases using the calculated break points.
            const filesToShare: File[] = [];
            for (let i = 0; i < finalBreakPoints.length - 1; i++) {
                const yOffset = finalBreakPoints[i];
                const pageEndY = finalBreakPoints[i + 1];
                const sliceHeight = pageEndY - yOffset;
                if (sliceHeight <= 0)
                    continue;
                const pageCanvas = document.createElement('canvas');
                const pageCtx = pageCanvas.getContext('2d');
                if (!pageCtx)
                    continue;
                pageCanvas.width = totalWidth;
                pageCanvas.height = sliceHeight;
                // Copy the slice from the main canvas to the page canvas
                pageCtx.drawImage(canvas, // source canvas
                0, yOffset, // source x, y
                totalWidth, sliceHeight, // source width, height
                0, 0, // destination x, y
                totalWidth, sliceHeight // destination width, height
                );
                const blob = await new Promise<Blob | null>(resolve => pageCanvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    const fileName = finalBreakPoints.length > 2
                        ? reportData.filename.replace('.pdf', `_page_${i + 1}.png`)
                        : reportData.filename.replace('.pdf', '.png');
                    const pageFile = new File([blob], fileName, { type: "image/png" });
                    filesToShare.push(pageFile);
                }
            }
            // --- Step 4: Share all the generated images ---
            if (filesToShare.length === 0) {
                alert("فشل إنشاء الصور.");
                setIsSharing(false);
                return;
            }
            if (navigator.share && navigator.canShare && navigator.canShare({ files: filesToShare })) {
                await navigator.share({
                    title: reportData.filename.replace('.pdf', ''),
                    text: filesToShare.length > 1 ? `تقرير من ${filesToShare.length} صفحات.` : 'تقرير المعاملات',
                    files: filesToShare,
                });
            }
            else {
                alert("خاصية المشاركة غير مدعومة. Les images seront téléchargées.");
                // Fallback to download each image individually
                for (const file of filesToShare) {
                    const link = document.createElement('a');
                    link.download = file.name;
                    link.href = URL.createObjectURL(file);
                    link.click();
                    URL.revokeObjectURL(link.href);
                    await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between downloads
                }
            }
        }
        catch (error) {
            console.error("فشل إنشاء الصور المقسمة:", error);
            alert("فشل تقسيم التقرير إلى صفحات.");
        }
        finally {
            setIsSharing(false);
        }
    };
    return (<Modal isOpen={isOpen} onClose={onClose} className="bg-surface text-neutral-900 max-w-4xl w-full">
      <ModalHeader onClose={onClose}>
        <ModalTitle>Aperçu du Rapport</ModalTitle>
      </ModalHeader>
      <ModalContent className="p-2 sm:p-4 max-h-[70vh] overflow-y-auto">
        {reportData && (
        // The report HTML is rendered inside a white container for generation consistency
        <div ref={reportPrintRef} className="rounded-lg bg-surface shadow-card">
              <div dangerouslySetInnerHTML={{ __html: reportData.html }}/>
          </div>)}
      </ModalContent>
      <ModalFooter>
        <Button onClick={handleShareImage} disabled={isSharing} className="w-full gap-2">
          {isSharing ? 'Préparation...' : (canShare ? (<>
                <ShareIcon className="w-5 h-5"/> Partager
              </>) : (<>
                <DownloadCloudIcon className="w-5 h-5"/> Télécharger l'Image
              </>))}
        </Button>
      </ModalFooter>
    </Modal>);
}
