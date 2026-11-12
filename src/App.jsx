import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Upload, FileSpreadsheet, MessageSquare, Send, CheckCircle2, RotateCcw, ArrowRight, ArrowLeft, ShieldCheck, Lock, ExternalLink, MessageCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

// 🔑 TUS CREDENCIALES DE SUPABASE
const SUPABASE_URL = "https://zbqgwwkhxjxfmzmltglm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_G_Vvo4v1DFXFJy-ojrCLZA_rCbLPSeP";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPhoneCheck, setInputPhoneCheck] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(() => {
    return Number(localStorage.getItem('celsender_step')) || 1;
  });
  
  const [countryCode, setCountryCode] = useState('593');
  
  const [excelData, setExcelData] = useState(() => {
    const saved = localStorage.getItem('celsender_excel');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [fileName, setFileName] = useState(() => {
    return localStorage.getItem('celsender_filename') || '';
  });

  const [messageTemplate, setMessageTemplate] = useState(() => {
    return localStorage.getItem('celsender_template') || '';
  });

  const [sentStatuses, setSentStatuses] = useState(() => {
    const saved = localStorage.getItem('celsender_progress');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    const savedAuth = localStorage.getItem('celsender_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('celsender_step', currentStep);
  }, [currentStep]);

  useEffect(() => {
    localStorage.setItem('celsender_template', messageTemplate);
  }, [messageTemplate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanInput = inputPhoneCheck.trim().replace(/^0/, '');
    if (!cleanInput) return;

    setLoadingLogin(true);

    try {
      const { data, error } = await supabase
        .from('authorized_users')
        .select('*')
        .eq('phone', cleanInput)
        .single();

      if (error || !data) {
        alert('⚠️ Este número no está autorizado o no se encuentra registrado en el sistema.');
        setLoadingLogin(false);
        return;
      }

      if (data.expiry_date) {
        const expiry = new Date(data.expiry_date);
        const now = new Date();
        if (expiry < now) {
          alert('❌ Tu licencia mensual ha caducado. Comunícate con la administración para renovarla.');
          setLoadingLogin(false);
          return;
        }
      }

      setIsAuthenticated(true);
      localStorage.setItem('celsender_auth', 'true');
    } catch (err) {
      console.error(err);
      alert('Error de conexión al validar el número.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    localStorage.setItem('celsender_filename', file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonRows.length === 0) {
          alert('El archivo de Excel está vacío.');
          return;
        }

        const formattedData = jsonRows.map((row, index) => {
          const normalizedRow = {};
          Object.keys(row).forEach((key) => {
            normalizedRow[key.trim().toLowerCase()] = String(row[key]).trim();
          });

          return {
            id: index,
            nombre: normalizedRow['nombre'] || normalizedRow['name'] || normalizedRow['cliente'] || `Clienta ${index + 1}`,
            telefono: normalizedRow['telefono'] || normalizedRow['celular'] || normalizedRow['phone'] || '',
            deuda: normalizedRow['deuda'] || normalizedRow['saldo'] || normalizedRow['monto'] || '$0.00',
            nivel: normalizedRow['nivel'] || normalizedRow['categoria'] || 'General'
          };
        }).filter(client => client.telefono !== '');

        if (formattedData.length > 0) {
          setExcelData(formattedData);
          localStorage.setItem('celsender_excel', JSON.stringify(formattedData));
          setSentStatuses({});
          localStorage.removeItem('celsender_progress');
          alert(`¡Se cargaron exitosamente ${formattedData.length} contactos!`);
        } else {
          alert('No se encontraron teléfonos válidos en el Excel.');
        }
      } catch (error) {
        console.error(error);
        alert('Hubo un error al leer el archivo Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const insertVariable = (variable) => {
    setMessageTemplate((prev) => prev + ` {${variable}}`);
  };

  const getProcessedMessage = (client) => {
    let msg = messageTemplate;
    msg = msg.replace(/{nombre}/g, client.nombre || '');
    msg = msg.replace(/{telefono}/g, client.telefono || '');
    msg = msg.replace(/{deuda}/g, client.deuda || '');
    msg = msg.replace(/{nivel}/g, client.nivel || '');
    return msg;
  };

  const handleOpenChat = (client) => {
    let cleanNumber = client.telefono.replace(/\D/g, '');
    if (cleanNumber.startsWith('0') && cleanNumber.length === 10) {
      cleanNumber = countryCode + cleanNumber.substring(1);
    } else if (cleanNumber.length === 9 && !cleanNumber.startsWith(countryCode)) {
      cleanNumber = countryCode + cleanNumber;
    }

    const finalMsg = getProcessedMessage(client);
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(finalMsg)}`;

    window.open(whatsappUrl, '_blank');

    const updatedStatuses = { ...sentStatuses, [client.id]: true };
    setSentStatuses(updatedStatuses);
    localStorage.setItem('celsender_progress', JSON.stringify(updatedStatuses));
  };

  const resetProgress = () => {
    if (window.confirm('¿Deseas reiniciar el progreso de todos los envíos?')) {
      setSentStatuses({});
      localStorage.removeItem('celsender_progress');
    }
  };

  // PANTALLA DE ACCESO
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '480px', margin: 'auto', minHeight: '100vh', backgroundColor: '#faf8f5', color: '#2c3e40', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '14px', backgroundColor: '#f9f0c3', borderRadius: '50%', border: '1px solid #ebd1a6', color: '#5b9ea6' }}>
            <Lock size={28} />
          </div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#5b9ea6' }}>CelSender Web</h2>
          <p style={{ margin: 0, fontSize: '11px', color: '#666', padding: '0 10px' }}>
            Ingresa tu número celular autorizado para acceder a tu panel de envíos.
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#5b9ea6', marginBottom: '4px' }}>
              Número de Celular:
            </label>
            <input
              type="text"
              placeholder="Ej: 593912345678"
              value={inputPhoneCheck}
              onChange={(e) => setInputPhoneCheck(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #93c4c8', backgroundColor: '#ffffff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loadingLogin}
            style={{ width: '100%', backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <ShieldCheck size={16} />
            <span>{loadingLogin ? 'Validando...' : 'Ingresar al Sistema'}</span>
          </button>
        </form>

        <footer style={{ backgroundColor: '#ffffff', borderTop: '1px solid #93c4c8', padding: '10px', textAlign: 'center', fontSize: '10px', color: '#666', borderRadius: '8px' }}>
          <p style={{ margin: 0 }}>© 2026 CelSender • Desarrollado por <span style={{ color: '#5b9ea6', fontWeight: 'bold' }}>celiadigitalec</span></p>
        </footer>

        <a 
          href="https://wa.me/593999999999?text=Hola%20Celia,%20tengo%20una%20duda%20sobre%20CelSender" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#25D366', color: '#fff', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 1000, textDecoration: 'none' }}
          title="¿Dudas o sugerencias? Contáctame"
        >
          <MessageCircle size={26} />
        </a>
      </div>
    );
  }

  // PANEL PRINCIPAL WEB / MÓVIL
  const totalContacts = excelData.length;
  const sentCount = Object.keys(sentStatuses).length;
  const progressPercent = totalContacts > 0 ? Math.round((sentCount / totalContacts) * 100) : 0;

  const sampleClient = excelData[0] || { nombre: 'María', telefono: '0999999999', deuda: '$45.00', nivel: 'VIP' };
  const previewMessage = getProcessedMessage(sampleClient);

  return (
    <div style={{ maxWidth: '480px', margin: 'auto', minHeight: '100vh', backgroundColor: '#faf8f5', color: '#2c3e40', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', position: 'relative', paddingBottom: '20px' }}>
      
      {/* Header */}
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #93c4c8', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#5b9ea6' }}>CelSender Web</h1>
          <p style={{ margin: 0, fontSize: '10px', color: '#666' }}>Licencia Activa 🟢</p>
        </div>
        <button
          onClick={() => { setIsAuthenticated(false); localStorage.clear(); }}
          style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', border: '1px solid #ebd1a6', padding: '5px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Cerrar 🔒
        </button>
      </header>

      {/* Stepper */}
      <div style={{ padding: '8px 14px 0 14px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '6px', borderRadius: '8px', border: '1px solid #93c4c8', display: 'flex', justifyContent: 'space-around', fontSize: '11px', fontWeight: 'bold' }}>
          <span style={{ color: currentStep === 1 ? '#5b9ea6' : '#999' }}>1. Excel</span>
          <span style={{ color: '#ccc' }}>→</span>
          <span style={{ color: currentStep === 2 ? '#5b9ea6' : '#999' }}>2. Mensaje</span>
          <span style={{ color: '#ccc' }}>→</span>
          <span style={{ color: currentStep === 3 ? '#5b9ea6' : '#999' }}>3. Envío Semáforo</span>
        </div>
      </div>

      {/* Contenido Dinámico */}
      <main style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* PASO 1: CARGAR EXCEL */}
        {currentStep === 1 && (
          <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={15} style={{ color: '#5b9ea6' }} />
              <h2 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#5b9ea6' }}>Cargar Base de Contactos</h2>
            </div>

            <div style={{ border: '2px dashed #93c4c8', borderRadius: '8px', padding: '16px', textAlign: 'center', backgroundColor: '#faf8f5' }}>
              <Upload size={22} style={{ color: '#5b9ea6', margin: '0 auto 6px auto', display: 'block' }} />
              <p style={{ margin: '0 0 6px 0', fontSize: '10px', color: '#444', fontWeight: '500' }}>
                {fileName ? `Excel: ${fileName}` : `Cargados: ${excelData.length} contactos`}
              </p>
              <label style={{ display: 'inline-block', backgroundColor: '#f9f0c3', color: '#2c3e40', fontSize: '10px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #ebd1a6' }}>
                <span>Subir archivo .xlsx</span>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                  onChange={handleExcelUpload} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>

            <button
              onClick={() => {
                if (excelData.length === 0) { alert('Sube un archivo Excel primero.'); return; }
                setCurrentStep(2);
              }}
              style={{ width: '100%', backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '9px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <span>Continuar a Redactar</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* PASO 2: REDACTAR MENSAJE */}
        {currentStep === 2 && (
          <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={15} style={{ color: '#5b9ea6' }} />
              <h2 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#5b9ea6' }}>Plantilla de Mensaje</h2>
            </div>

            <div>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#5b9ea6', display: 'block', marginBottom: '3px' }}>Variables del Excel:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {['nombre', 'telefono', 'deuda', 'nivel'].map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', fontSize: '9px', fontWeight: 'bold', padding: '3px 6px', borderRadius: '4px', border: '1px solid #ebd1a6', cursor: 'pointer' }}
                  >
                    +{v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#5b9ea6', display: 'block', marginBottom: '3px' }}>Redacta tu mensaje:</span>
              <textarea
                rows="4"
                placeholder="Escribe aquí tu mensaje..."
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #93c4c8', backgroundColor: '#faf8f5', fontSize: '11px', outline: 'none', color: '#2c3e40', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '8px', border: '1px solid #86efac' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#166534', display: 'block', marginBottom: '2px' }}>
                👁️ Vista previa:
              </span>
              <p style={{ margin: 0, fontSize: '10px', color: '#14532d', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {previewMessage || <span style={{ color: '#888', fontStyle: 'italic' }}>Escribe algo arriba...</span>}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
              <button
                onClick={() => setCurrentStep(1)}
                style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', border: '1px solid #ebd1a6', padding: '7px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={12} />
                <span>Atrás</span>
              </button>
              <button
                onClick={() => {
                  if (excelData.length === 0) { alert('Sube un Excel primero.'); setCurrentStep(1); return; }
                  if (!messageTemplate.trim()) { alert('Por favor escribe un mensaje antes de continuar.'); return; }
                  setCurrentStep(3);
                }}
                style={{ flex: 1, backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '7px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <span>Ir a Envíos</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: CONTROL DE ENVÍOS SEMÁFORO (MUESTRA NOMBRE Y LAS PRIMERAS LÍNEAS DEL MENSAJE) */}
        {currentStep === 3 && (
          <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Send size={15} style={{ color: '#5b9ea6' }} />
                <h2 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#5b9ea6' }}>Cola de Envíos (Semáforo)</h2>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ backgroundColor: '#f9f0c3', color: '#5b9ea6', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '8px', border: '1px solid #ebd1a6' }}>
                  {sentCount} / {totalContacts} ({progressPercent}%)
                </span>
                <button onClick={resetProgress} title="Reiniciar progreso" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e06d6d', padding: 0 }}>
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>

            {excelData.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '15px 0' }}>No hay contactos cargados. Vuelve al Paso 1.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                {excelData.map((client) => {
                  const isSent = sentStatuses[client.id] === true;
                  const clientMessage = getProcessedMessage(client);
                  return (
                    <div 
                      key={client.id} 
                      style={{ 
                        backgroundColor: isSent ? '#f0fdf4' : '#faf8f5', 
                        padding: '9px 12px', 
                        borderRadius: '8px', 
                        border: `1px solid ${isSent ? '#86efac' : '#93c4c8'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div style={{ overflow: 'hidden', flex: 1 }}>
                        {/* Nombre del cliente */}
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2c3e40', marginBottom: '2px' }}>
                          👤 {client.nombre} {isSent && '✅'}
                        </div>
                        {/* Vista previa personalizada del mensaje que se enviará */}
                        <div style={{ fontSize: '9px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: 'italic' }}>
                          "{clientMessage || 'Sin mensaje redactado'}"
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenChat(client)}
                        style={{
                          backgroundColor: isSent ? '#10b981' : '#5b9ea6',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <ExternalLink size={11} />
                        <span>{isSent ? 'Reenviar' : 'Enviar'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setCurrentStep(2)}
              style={{ width: '100%', backgroundColor: '#faf8f5', color: '#5b9ea6', border: '1px solid #93c4c8', padding: '7px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '2px' }}
            >
              ← Volver al Redactor
            </button>
          </div>
        )}
      </main>

      {/* Footer Presumible y Visible */}
      <footer style={{ backgroundColor: '#ffffff', borderTop: '1px solid #93c4c8', padding: '10px 14px', textAlign: 'center', fontSize: '10px', color: '#666', margin: '0 14px', borderRadius: '8px' }}>
        <p style={{ margin: 0 }}>© 2026 CelSender • Desarrollado por <span style={{ color: '#5b9ea6', fontWeight: 'bold' }}>celiadigitalec</span></p>
      </footer>

      {/* Botón Flotante de WhatsApp */}
      <a 
        href="https://wa.me/593999999999?text=Hola%20Celia,%20tengo%20una%20duda%20sobre%20CelSender" 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#25D366', color: '#fff', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 1000, textDecoration: 'none' }}
        title="¿Dudas o sugerencias? Contáctame"
      >
        <MessageCircle size={26} />
      </a>
    </div>
  );
}