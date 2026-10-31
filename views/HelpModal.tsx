import React, { useState, useEffect } from 'react';

/** Vídeos tutoriais ocultos enquanto os vídeos são atualizados. Troque para true para mostrar de novo. */
const SHOW_TUTORIALS = false;
import { X, Play, Plus, Trash2, MessageCircle } from 'lucide-react';
import { api } from '../api';
import { User, UserRole, TutorialVideo } from '../types';

interface HelpModalProps {
  onClose: () => void;
  currentUser: User;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose, currentUser }) => {
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (SHOW_TUTORIALS) loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const data = await api.getTutorialVideos();
      setVideos(data);
    } catch (error) {
      console.error("Error loading videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !newTitle) {
      alert("Preencha o título e selecione um vídeo.");
      return;
    }

    setIsUploading(true);
    try {
      // In a real app, we would upload to Supabase Storage here.
      // Since we don't have the storage API method implemented yet, let's add it to api.ts.
      const videoUrl = await api.uploadTutorialVideo(selectedFile);
      await api.createTutorialVideo(newTitle, videoUrl);
      
      setNewTitle('');
      setSelectedFile(null);
      await loadVideos();
      alert("Vídeo publicado com sucesso!");
    } catch (error: any) {
      console.error("Upload error:", error);
      alert("Erro ao enviar vídeo: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este vídeo?")) {
      try {
        await api.deleteTutorialVideo(id);
        await loadVideos();
      } catch (error) {
        console.error("Delete error:", error);
        alert("Erro ao excluir vídeo.");
      }
    }
  };

  const handleWhatsApp = () => {
    window.open('https://wa.me/5511983007513', '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col animate-in fade-in duration-200">
      <div className="flex justify-between items-center p-4 bg-pitch text-white">
        <h2 className="font-black italic uppercase text-xl">{SHOW_TUTORIALS ? 'Ajuda e Tutoriais' : 'Ajuda'}</h2>
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full active:scale-95">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border text-center">
          <h3 className="font-black text-pitch uppercase mb-2">Precisa de ajuda?</h3>
          <p className="text-xs text-gray-500 mb-4">Fale diretamente com nosso suporte via WhatsApp.</p>
          <button 
            onClick={handleWhatsApp}
            className="w-full py-4 bg-green-500 text-white rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-95"
          >
            <MessageCircle className="w-5 h-5" />
            Chamar no WhatsApp
          </button>
        </div>

        {SHOW_TUTORIALS && currentUser.role === UserRole.SUPER_ADMIN && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border">
            <h3 className="font-black text-pitch uppercase mb-4 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Adicionar Tutorial
            </h3>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Título do Vídeo (ex: Como criar uma partida)" 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl p-4 text-xs font-bold focus:ring-2 focus:ring-grass-500"
              />
              <input 
                type="file" 
                accept="video/*"
                onChange={handleFileChange}
                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-grass-50 file:text-grass-600 hover:file:bg-grass-100"
              />
              <button 
                onClick={handleUpload}
                disabled={isUploading || !selectedFile || !newTitle}
                className="w-full py-3 bg-pitch text-white rounded-xl font-black uppercase text-xs disabled:opacity-50"
              >
                {isUploading ? 'Enviando...' : 'Publicar Vídeo'}
              </button>
            </div>
          </div>
        )}

        {SHOW_TUTORIALS && (<div>
          <h3 className="font-black text-pitch uppercase mb-4 text-sm">Vídeos Tutoriais</h3>
          
          {loading ? (
            <div className="text-center text-gray-400 font-bold text-xs py-10">Carregando vídeos...</div>
          ) : videos.length === 0 ? (
            <div className="text-center text-gray-400 font-bold text-xs py-10">Nenhum vídeo disponível no momento.</div>
          ) : (
            <div className="space-y-4">
              {videos.map(video => (
                <div key={video.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border">
                  <div className="aspect-video bg-black relative">
                    <video 
                      src={video.videoUrl} 
                      controls 
                      className="w-full h-full object-contain"
                      preload="metadata"
                    />
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <h4 className="font-black text-pitch text-sm">{video.title}</h4>
                    {currentUser.role === UserRole.SUPER_ADMIN && (
                      <button 
                        onClick={() => handleDelete(video.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>)}

      </div>
    </div>
  );
};
