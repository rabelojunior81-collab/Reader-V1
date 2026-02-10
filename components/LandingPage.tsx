import React from 'react';
import { BookOpenIcon, SparklesIcon, SystemIcon } from './Icons'; 

interface LandingPageProps {
  onFilesSelected: (files: FileList) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onFilesSelected }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const FileTypeIcon: React.FC<IconProps> = (props) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
  );
  
  type IconProps = React.SVGProps<SVGSVGElement>;
  const PrivacyIcon: React.FC<IconProps> = (props) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
  );


  return (
    <div className="flex-grow flex flex-col items-center justify-center text-center p-4 sm:p-6 lg:p-8 bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
      <div className="relative w-full max-w-4xl mx-auto">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-400/20 dark:bg-emerald-500/10 rounded-full filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-400/20 dark:bg-amber-500/10 rounded-full filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

        <main className="relative z-10">
          <div className="flex justify-center items-center gap-4 mb-4">
            <BookOpenIcon className="w-12 h-12 text-emerald-600 dark:text-emerald-500" />
            <h1 className="text-4xl sm:text-5xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Rabelus.ai Reader
            </h1>
          </div>
          <p className="max-w-2xl mx-auto mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-400">
            Sua biblioteca pessoal, mais inteligente do que nunca. Leitura guiada por IA para quadrinhos e suporte para EPUBs e PDFs.
          </p>

          <div className="mt-10">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 sm:px-8 sm:py-4 bg-emerald-600 text-white font-bold text-lg rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-600/50 transform hover:scale-105 transition-all duration-300 shadow-lg"
            >
              Adicionar seu primeiro livro
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && onFilesSelected(e.target.files)}
              multiple
              accept=".cbz,.epub,.pdf"
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-12 sm:mt-16 max-w-4xl mx-auto">
            <div className="p-6 bg-zinc-200/40 dark:bg-zinc-800/40 rounded-md backdrop-blur-sm border border-zinc-300 dark:border-zinc-700">
              <SparklesIcon className="w-8 h-8 mx-auto text-amber-600 dark:text-amber-500 mb-3" />
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Leitura Guiada por IA</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Navegue por quadrinhos painel a painel, com detecção automática por IA.</p>
            </div>
            <div className="p-6 bg-zinc-200/40 dark:bg-zinc-800/40 rounded-md backdrop-blur-sm border border-zinc-300 dark:border-zinc-700">
              <FileTypeIcon className="w-8 h-8 mx-auto text-amber-600 dark:text-amber-500 mb-3" />
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Suporte a Formatos</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Leia seus arquivos <b className="font-semibold">.cbz</b>, <b className="font-semibold">.epub</b> e <b className="font-semibold">.pdf</b> em um só lugar.</p>
            </div>
            <div className="p-6 bg-zinc-200/40 dark:bg-zinc-800/40 rounded-md backdrop-blur-sm border border-zinc-300 dark:border-zinc-700">
              <PrivacyIcon className="w-8 h-8 mx-auto text-amber-600 dark:text-amber-500 mb-3" />
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Privado e Offline</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Seus livros ficam no seu navegador. Nenhuma informação é enviada para servidores.</p>
            </div>
          </div>
        </main>
      </div>
      <style>{`
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-4000 {
            animation-delay: -4s;
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
      `}</style>
    </div>
  );
};