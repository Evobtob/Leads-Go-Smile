
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Lead } from '../types';

interface DashboardProps {
  leads: Lead[];
  monthLabel: string;
}

const Dashboard: React.FC<DashboardProps> = ({ leads, monthLabel }) => {
  const total = leads.length;
  const positive = leads.filter(l => l.status === 'positive').length;
  const scheduled = leads.filter(l => l.status === 'scheduled').length;
  const lixo = leads.filter(l => l.status === 'discarded').length;

  const getPercent = (count: number) => total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="py-4">
      <div className="bg-white rounded-[40px] ios-shadow border border-gray-50 p-8 flex flex-col items-center mb-6">
        <div className="inline-flex items-center gap-2 bg-[#F1F4F8] px-4 py-2 rounded-2xl text-[12px] font-semibold text-[#718096] mb-12">
          {monthLabel} <ChevronDown size={14} />
        </div>

        {/* Circular Progress (Visual Representation) */}
        <div className="relative w-56 h-56 flex items-center justify-center mb-16">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="112"
              cy="112"
              r="100"
              fill="transparent"
              stroke="#F1F4F8"
              strokeWidth="20"
            />
            <circle
              cx="112"
              cy="112"
              r="100"
              fill="transparent"
              stroke="#E2E8F0"
              strokeWidth="20"
              strokeDasharray="628"
              strokeDashoffset="200"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-6xl font-bold text-[#2D3748]">{total}</span>
            <span className="text-[12px] font-bold text-[#A0AEC0] tracking-widest uppercase">Leads</span>
          </div>
        </div>

        <div className="grid grid-cols-2 w-full gap-4">
          <div className="flex flex-col items-center border-r border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
               <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
               <span className="text-xl font-bold text-[#2D3748]">{getPercent(scheduled)}%</span>
               <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600 whitespace-nowrap">
                 Total: {scheduled}
               </span>
            </div>
            <span className="text-[10px] font-bold text-[#A0AEC0] uppercase">Agendadas</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-1">
               <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
               <span className="text-xl font-bold text-[#2D3748]">{getPercent(lixo)}%</span>
            </div>
            <span className="text-[10px] font-bold text-[#A0AEC0] uppercase">Descartadas</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-[32px] ios-shadow border border-gray-50 p-6">
            <span className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-wider block mb-2">Conversão</span>
            <span className="text-3xl font-bold text-[#2D3748]">{getPercent(scheduled + positive)}%</span>
        </div>
        <div className="bg-white rounded-[32px] ios-shadow border border-gray-50 p-6">
            <span className="text-[10px] font-bold text-[#A0AEC0] uppercase tracking-wider block mb-2">Objetivo</span>
            <span className="text-3xl font-bold text-[#2D3748]">25%</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
