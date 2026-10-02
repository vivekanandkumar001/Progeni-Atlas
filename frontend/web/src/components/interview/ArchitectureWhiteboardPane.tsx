'use client';

import React, { useState } from 'react';
import { Layers, Database, Cpu, Server, HardDrive, Plus, Trash2, Smartphone } from 'lucide-react';

interface WhiteboardNode {
  id: string;
  type: 'service' | 'database' | 'kafka' | 'redis' | 'balancer' | 'client';
  label: string;
  x: number;
  y: number;
}

interface ArchitectureWhiteboardPaneProps {
  onGraphUpdate?: (nodes: WhiteboardNode[]) => void;
}

export const ArchitectureWhiteboardPane: React.FC<ArchitectureWhiteboardPaneProps> = ({ onGraphUpdate }) => {
  const [nodes, setNodes] = useState<WhiteboardNode[]>([
    { id: 'n-1', type: 'client', label: 'Client Mobile / Web App', x: 40, y: 120 },
    { id: 'n-2', type: 'balancer', label: 'AWS ALB / Nginx Gateway', x: 240, y: 120 },
    { id: 'n-3', type: 'service', label: 'Rate Limiter Service', x: 440, y: 60 },
    { id: 'n-4', type: 'redis', label: 'Redis Cluster (Sliding Window)', x: 660, y: 60 },
    { id: 'n-5', type: 'kafka', label: 'Kafka Event Log Stream', x: 440, y: 190 },
    { id: 'n-6', type: 'database', label: 'PostgreSQL Primary DB', x: 660, y: 190 }
  ]);

  const addNode = (type: 'service' | 'database' | 'kafka' | 'redis' | 'balancer' | 'client') => {
    const labels: Record<string, string> = {
      service: 'Microservice Node',
      database: 'PostgreSQL Storage',
      kafka: 'Kafka Queue Stream',
      redis: 'Redis In-Memory Cache',
      balancer: 'Load Balancer / ALB',
      client: 'Client Application'
    };
    const newNode: WhiteboardNode = {
      id: 'n-' + Date.now(),
      type,
      label: labels[type],
      x: 150 + Math.floor(Math.random() * 250),
      y: 80 + Math.floor(Math.random() * 120)
    };
    const updated = [...nodes, newNode];
    setNodes(updated);
    onGraphUpdate?.(updated);
  };

  const clearCanvas = () => {
    setNodes([]);
    onGraphUpdate?.([]);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'client': return <Smartphone className="w-4 h-4 text-cyan-400" />;
      case 'balancer': return <Cpu className="w-4 h-4 text-indigo-400" />;
      case 'redis': return <HardDrive className="w-4 h-4 text-amber-400" />;
      case 'kafka': return <Layers className="w-4 h-4 text-purple-400" />;
      case 'database': return <Database className="w-4 h-4 text-emerald-400" />;
      default: return <Server className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      
      {/* WHITEBOARD PALETTE TOOLBAR */}
      <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono text-slate-400 mr-1">Drag & Drop Infra Nodes:</span>
          
          <button
            type="button"
            onClick={() => addNode('service')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-300 text-xs transition-colors cursor-pointer"
          >
            + Microservice
          </button>
          <button
            type="button"
            onClick={() => addNode('database')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-300 text-xs transition-colors cursor-pointer"
          >
            + PostgreSQL
          </button>
          <button
            type="button"
            onClick={() => addNode('kafka')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-purple-300 text-xs transition-colors cursor-pointer"
          >
            + Kafka Queue
          </button>
          <button
            type="button"
            onClick={() => addNode('redis')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-300 text-xs transition-colors cursor-pointer"
          >
            + Redis Cache
          </button>
          <button
            type="button"
            onClick={() => addNode('balancer')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-indigo-300 text-xs transition-colors cursor-pointer"
          >
            + Load Balancer
          </button>
        </div>

        <button
          type="button"
          onClick={clearCanvas}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Diagram</span>
        </button>
      </div>

      {/* SVG INTERACTIVE GRAPH CANVAS */}
      <div className="relative flex-1 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] min-h-[350px] p-6 overflow-auto">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
            </marker>
          </defs>

          {nodes.map((node, i) => {
            if (i === 0) return null;
            const prev = nodes[i - 1];
            return (
              <line
                key={`line-${node.id}`}
                x1={prev.x + 90}
                y1={prev.y + 25}
                x2={node.x}
                y2={node.y + 25}
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="4 4"
                markerEnd="url(#arrow)"
                className="animate-pulse"
              />
            );
          })}
        </svg>

        {/* NODES MATRIX */}
        {nodes.map((node) => (
          <div
            key={node.id}
            style={{ left: `${node.x}px`, top: `${node.y}px` }}
            className="absolute p-3 rounded-xl bg-slate-900/90 border border-slate-700 shadow-xl backdrop-blur-md flex items-center gap-2.5 cursor-grab hover:border-cyan-400 transition-all group"
          >
            {getNodeIcon(node.type)}
            <div>
              <p className="text-xs font-semibold text-slate-100">{node.label}</p>
              <p className="text-[10px] font-mono text-slate-400 capitalize">{node.type} node</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
