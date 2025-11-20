import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from './components/ui/Button';
import { ShareIcon } from './components/icons/ShareIcon';
import { DownloadCloudIcon } from './components/icons/DownloadCloudIcon';
import { ChevronLeftIcon } from './components/icons/ChevronLeftIcon';

declare const html2canvas: any;

function ReportPreviewApp() {
    const [reportHtml, setReportHtml] = useState<string | null>(null);
    const [filename, setFilename] = useState<string>('report.pdf');
    const [isLoading, setIsLoading] = useState(true);
    const [isSharing, setIsSharing] = useState(false);
    const reportContentRef = useRef<HTMLDivElement>(null);

    const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

    useEffect(() => {
        // Attempt to match the main app's theme
        if (localStorage.getItem('usdt_theme') === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        const storedHtml = sessionStorage.getItem('reportHtml');
        const storedFilename = sessionStorage.getItem('reportFilename');

        if (storedHtml && storedFilename) {
            setReportHtml(storedHtml);
            setFilename(storedFilename);
            // Cleanup session storage
            sessionStorage.removeItem('reportHtml');
            sessionStorage.removeItem('reportFilename');
        }
        setIsLoading(false);
    }, []);

    const handleShare = async () => {
        if (!reportContentRef.current || isSharing) return;
        setIsSharing(true);

        try {
            const canvas = await html2canvas(reportContentRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    alert("Échec de la création de l'image.");
                    setIsSharing(false);
                    return;
                }

                const imageFile = new File([blob], filename.replace('.pdf', '.png'), { type: 'image/png' });

                if (canShare && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
                    await navigator.share({
                        title: 'Rapport ProDigital',
                        text: `Voici le rapport: ${filename}`,
                        files: [imageFile],
                    });
                } else {
                    // Fallback to download
                    const link = document.createElement('a');
                    link.download = imageFile.name;
                    link.href = URL.createObjectURL(blob);
                    link.click();
                    URL.revokeObjectURL(link.href);
                }
            }, 'image/png');
        } catch (error) {
            console.error('Error sharing:', error);
            alert("Une erreur est survenue lors de la génération de l'image.");
        } finally {
            setIsSharing(false);
        }
    };

    const isDark = document.documentElement.classList.contains('dark');
    const bgApp = isDark ? 'bg-[#0F172A] text-gray-100' : 'bg-[#F1F5F9] text-gray-900';
    
    if (isLoading) {
        return <div className={`min-h-screen ${bgApp} flex items-center justify-center`}>Chargement du rapport...</div>;
    }

    if (!reportHtml) {
        return (
             <div className={`min-h-screen ${bgApp} flex flex-col items-center justify-center text-center p-4`}>
                <h1 className="text-2xl font-bold mb-4">Erreur</h1>
                <p>Aucune donnée de rapport trouvée. Veuillez retourner et générer le rapport à nouveau.</p>
                <Button onClick={() => window.history.back()} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Retour</Button>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${bgApp}`}>
            <header className="sticky top-0 z-10 p-4 flex items-center justify-between border-b" style={{borderColor: isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(229, 231, 235, 0.8)', background: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(241, 245, 249, 0.8)', backdropFilter: 'blur(8px)'}}>
                <Button onClick={() => window.history.back()} className={`flex items-center gap-2 font-semibold p-2 rounded-lg ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}>
                    <ChevronLeftIcon className="w-5 h-5"/>
                    Retour
                </Button>
                <h1 className="text-lg font-bold">Aperçu du Rapport</h1>
                <div className="w-24"></div> {/* Spacer */}
            </header>
            
            <main className="p-2 sm:p-4 pb-24">
                 <div ref={reportContentRef} className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
                    <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
                 </div>
            </main>

            <footer className="fixed bottom-0 left-0 right-0 p-4 border-t" style={{borderColor: isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(229, 231, 235, 0.8)', background: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(241, 245, 249, 0.8)', backdropFilter: 'blur(8px)'}}>
                <div className="max-w-4xl mx-auto">
                    <Button onClick={handleShare} disabled={isSharing} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-lg">
                        {isSharing ? 'Préparation...' : (
                            canShare ? (
                                <>
                                    <ShareIcon className="w-5 h-5"/> Partager
                                </>
                            ) : (
                                <>
                                    <DownloadCloudIcon className="w-5 h-5"/> Télécharger l'Image
                                </>
                            )
                        )}
                    </Button>
                </div>
            </footer>
        </div>
    );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ReportPreviewApp />
  </React.StrictMode>
);