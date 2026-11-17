import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Upload, FileSpreadsheet, MessageSquare, Send, CheckCircle2, RotateCcw, ArrowRight, ArrowLeft, ShieldCheck, Lock, MessageCircle, Globe, Settings, UserPlus, Trash2, Edit2, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';

// 🔑 CREDENCIALES DE SUPABASE
const SUPABASE_URL = "https://zbqgwwkhxjxfmzmltglm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_G_Vvo4v1DFXFJy-ojrCLZA_rCbLPSeP";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('celsender_auth') === 'true';
  });
  
  const [loggedPhone, setLoggedPhone] = useState(() => {
    return localStorage.getItem('celsender_logged_phone') || '';
  });
  const [selectedFilters, setSelectedFilters] = useState({});
  const [inputPhoneCheck, setInputPhoneCheck] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  
  // Estados para el Panel de Administrador y su Modal de Clave
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const [adminUsersList, setAdminUsersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Formulario de Agregar / Editar Usuario
  const [newName, setNewName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminExpiry, setNewAdminExpiry] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(() => {
    return Number(localStorage.getItem('celsender_step')) || 1;
  });
  
  const [countryCode, setCountryCode] = useState(() => {
    return localStorage.getItem('celsender_country') || '593';
  });
  
  const [excelData, setExcelData] = useState(() => {
    const saved = localStorage.getItem('celsender_excel');
    return saved ? JSON.parse(saved) : [];
  });

  const [excelColumns, setExcelColumns] = useState(() => {
    const saved = localStorage.getItem('celsender_columns');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [fileName, setFileName] = useState(() => {
    return localStorage.getItem('celsender_filename') || '';
  });

  // Estados para filtros inteligentes de Estado y Nivel
  const [selectedStatus, setSelectedStatus] = useState('TODOS');
  const [selectedLevel, setSelectedLevel] = useState('TODOS');

  const [messageTemplate, setMessageTemplate] = useState(() => {
    return localStorage.getItem('celsender_template') || '';
  });

  const [sentStatuses, setSentStatuses] = useState(() => {
    const saved = localStorage.getItem('celsender_progress');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('celsender_step', currentStep);
  }, [currentStep]);

  useEffect(() => {
    localStorage.setItem('celsender_template', messageTemplate);
  }, [messageTemplate]);

  useEffect(() => {
    localStorage.setItem('celsender_country', countryCode);
  }, [countryCode]);

  useEffect(() => {
    localStorage.setItem('celsender_progress', JSON.stringify(sentStatuses));
  }, [sentStatuses]);

  // Manejador para subir el archivo Excel
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    localStorage.setItem('celsender_filename', file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (data.length > 0) {
          const columns = Object.keys(data[0]);
          setExcelColumns(columns);
          localStorage.setItem('celsender_columns', JSON.stringify(columns));

          setExcelData(data);
          localStorage.setItem('celsender_excel', JSON.stringify(data));
          
          setSentStatuses({});
          localStorage.removeItem('celsender_progress');
          setSelectedStatus('TODOS');
          setSelectedLevel('TODOS');
          alert(`✅ ¡Archivo cargado con éxito! Se encontraron ${data.length} contactos.`);
        } else {
          alert('⚠️ El archivo Excel está vacío.');
        }
      } catch (error) {
        console.error(error);
        alert('❌ Error al procesar el archivo Excel.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Insertar variable de columna en la plantilla de mensaje
  const insertVariable = (col) => {
    setMessageTemplate((prev) => `${prev} {${col}}`);
  };

  // Procesar mensaje con los datos del contacto
  const getProcessedMessage = (row) => {
    let msg = messageTemplate;
    Object.keys(row).forEach((key) => {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`{${escapedKey}}`, 'g');
      msg = msg.replace(regex, row[key] !== undefined ? row[key] : '');
    });
    return msg;
  };

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
      setLoggedPhone(cleanInput);
      localStorage.setItem('celsender_auth', 'true');
      localStorage.setItem('celsender_logged_phone', cleanInput);
    } catch (err) {
      console.error(err);
      alert('Error de conexión al validar el número.');
    } finally {
      setLoadingLogin(false);
    }
  };

  // Validar contraseña secreta desde el modal flotante
  const handleVerifyPassword = (e) => {
    e.preventDefault();
    const MASTER_PASSWORD = 'admin123';

    if (adminPasswordInput === MASTER_PASSWORD) {
      setShowPasswordModal(false);
      setAdminPasswordInput('');
      setIsAdminMode(true);
      fetchAdminUsers();
    } else {
      alert('❌ Contraseña incorrecta.');
      setAdminPasswordInput('');
    }
  };

  // Cargar lista de usuarios desde Supabase
  const fetchAdminUsers = async () => {
    setLoadingAdmin(true);
    try {
      const { data, error } = await supabase
        .from('authorized_users')
        .select('*')
        .order('expiry_date', { ascending: false });

      if (error) throw error;
      setAdminUsersList(data || []);
    } catch (err) {
      console.error(err);
      alert('Error al cargar la lista de usuarios.');
    } finally {
      setLoadingAdmin(false);
    }
  };

  // Guardar o Actualizar Usuario Registrado
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!newAdminPhone || !newAdminExpiry) {
      alert('Por favor completa el número y la fecha de expiración.');
      return;
    }

    const cleanPhone = newAdminPhone.trim().replace(/^0/, '');
    const userName = newName.trim() || 'Sin Nombre';
    const formattedExpiry = newAdminExpiry.includes('T') 
      ? newAdminExpiry 
      : `${newAdminExpiry}T23:59:59+00:00`;

    try {
      if (editingUserId) {
        const { error } = await supabase
          .from('authorized_users')
          .update({ 
            client_name: userName, 
            phone: cleanPhone, 
            expiry_date: formattedExpiry 
          })
          .eq('id', editingUserId);

        if (error) throw error;
        alert('✅ ¡Usuario actualizado exitosamente!');
      } else {
        const { error } = await supabase
          .from('authorized_users')
          .insert([{ 
            client_name: userName, 
            phone: cleanPhone, 
            expiry_date: formattedExpiry,
            is_active: true
          }]);

        if (error) throw error;
        alert('✅ ¡Usuario registrado exitosamente!');
      }

      setNewName('');
      setNewAdminPhone('');
      setNewAdminExpiry('');
      setEditingUserId(null);
      fetchAdminUsers();
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        alert('⚠️ Este número de teléfono ya está registrado. Usa el botón de editar si deseas actualizarlo.');
      } else {
        alert(`⚠️ Error de Supabase: ${err.message}`);
      }
    }
  };

  // Preparar datos para editar usuario
  const handleStartEdit = (user) => {
    setEditingUserId(user.id);
    setNewName(user.client_name || '');
    setNewAdminPhone(user.phone || '');
    
    const dateOnly = user.expiry_date ? user.expiry_date.split('T')[0] : '';
    setNewAdminExpiry(dateOnly);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingUserId(null);
    setNewName('');
    setNewAdminPhone('');
    setNewAdminExpiry('');
  };

  // Eliminar usuario
  const handleDeleteUser = async (id) => {
    if (!window.confirm('¿Deseas eliminar este usuario registrado?')) return;

    try {
      const { error } = await supabase
        .from('authorized_users')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchAdminUsers();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el usuario.');
    }
  };

  // Filtrar usuarios registrados por el buscador
  const filteredAdminUsers = adminUsersList.filter(u => {
    const query = searchQuery.toLowerCase();
    const nameMatch = (u.client_name || '').toLowerCase().includes(query);
    const phoneMatch = (u.phone || '').toLowerCase().includes(query);
    return nameMatch || phoneMatch;
  });

  // PANTALLA DE ACCESO
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '480px', margin: 'auto', minHeight: '100vh', backgroundColor: '#faf8f5', color: '#2c3e40', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', boxSizing: 'border-box', position: 'relative' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px' }}>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#5b9ea6' }}>CelSender Web</h1>
          <button 
            onClick={() => setShowPasswordModal(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5b9ea6', padding: '4px' }}
            title="Panel de Administrador"
          >
            <Settings size={22} />
          </button>
        </header>

        {isAdminMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f0c3', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ebd1a6' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#5b9ea6' }}>⚙️ Panel de Administrador</span>
              <button 
                onClick={() => { setIsAdminMode(false); setEditingUserId(null); }}
                style={{ backgroundColor: '#ffffff', border: '1px solid #ebd1a6', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', color: '#2c3e40' }}
              >
                Cerrar Panel ✖
              </button>
            </div>

            <form onSubmit={handleSaveUser} style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#5b9ea6' }}>
                {editingUserId ? '✏️ Editar Usuario' : '➕ Registrar Nuevo Usuario'}
              </span>
              <input 
                type="text" 
                placeholder="Nombre de la usuaria o usuario (Ej: María)" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #93c4c8', fontSize: '12px' }}
                required
              />
              <input 
                type="text" 
                placeholder="Número de Celular (Ej: 593912345678)" 
                value={newAdminPhone}
                onChange={(e) => setNewAdminPhone(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #93c4c8', fontSize: '12px' }}
                required
              />
              <input 
                type="date" 
                value={newAdminExpiry}
                onChange={(e) => setNewAdminExpiry(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #93c4c8', fontSize: '12px' }}
                required
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  type="submit"
                  style={{ flex: 1, backgroundColor: '#5b9ea6', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <UserPlus size={14} />
                  <span>{editingUserId ? 'Actualizar' : 'Guardar Usuario'}</span>
                </button>
                {editingUserId && (
                  <button 
                    type="button"
                    onClick={handleCancelEdit}
                    style={{ backgroundColor: '#ddd', color: '#333', border: 'none', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: '#888' }} />
              <input 
                type="text"
                placeholder="Buscar usuario por nombre o número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 8px 8px 32px', borderRadius: '6px', border: '1px solid #93c4c8', backgroundColor: '#ffffff', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #93c4c8', flex: 1, maxHeight: '200px', overflowY: 'auto' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#5b9ea6', display: 'block', marginBottom: '6px' }}>
                Usuarios Registrados ({filteredAdminUsers.length}):
              </span>
              {loadingAdmin ? (
                <p style={{ fontSize: '11px', textAlign: 'center' }}>Cargando...</p>
              ) : filteredAdminUsers.length === 0 ? (
                <p style={{ fontSize: '11px', color: '#666', textAlign: 'center' }}>No se encontraron usuarios.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {filteredAdminUsers.map((u) => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#faf8f5', borderRadius: '6px', border: '1px solid #ddd', fontSize: '11px' }}>
                      <div>
                        <div>
                          <strong style={{ color: '#2c3e40', fontSize: '12px' }}>👤 {u.client_name || 'Sin Nombre'}</strong>
                          <div style={{ color: '#5b9ea6' }}>+{u.phone}</div>
                          <div style={{ fontSize: '9px', color: '#666' }}>
                            Expira: {u.expiry_date ? u.expiry_date.split('T')[0] : 'Sin límite'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleStartEdit(u)}
                          style={{ background: 'none', border: 'none', color: '#5b9ea6', cursor: 'pointer' }}
                          title="Editar usuario"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          style={{ background: 'none', border: 'none', color: '#e06d6d', cursor: 'pointer' }}
                          title="Eliminar usuario"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, gap: '20px' }}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '16px', backgroundColor: '#f9f0c3', borderRadius: '50%', border: '1px solid #ebd1a6', color: '#5b9ea6' }}>
                <Lock size={32} />
              </div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#5b9ea6' }}>CelSender Web</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#555', padding: '0 10px', lineHeight: '1.4' }}>
                Ingresa tu número celular autorizado. Este número quedará amarrado a tu sesión activa.
              </p>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#5b9ea6', marginBottom: '6px' }}>
                  Número de Celular Autorizado:
                </label>
                <input
                  type="text"
                  placeholder="Ej: 593912345678"
                  value={inputPhoneCheck}
                  onChange={(e) => setInputPhoneCheck(e.target.value)}
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #93c4c8', backgroundColor: '#ffffff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loadingLogin}
                style={{ width: '100%', backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <ShieldCheck size={18} />
                <span>{loadingLogin ? 'Validando...' : 'Ingresar al Sistema'}</span>
              </button>
            </form>
          </div>
        )}

        {showPasswordModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#5b9ea6' }}>🔒 Clave de Administradora</h3>
                <button onClick={() => setShowPasswordModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleVerifyPassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input 
                  type="password" 
                  placeholder="Ingresa tu contraseña"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #93c4c8', fontSize: '14px', outline: 'none' }}
                  required
                  autoFocus
                />
                <button 
                  type="submit"
                  style={{ backgroundColor: '#5b9ea6', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Ingresar al Panel
                </button>
              </form>
            </div>
          </div>
        )}

        <footer style={{ backgroundColor: '#ffffff', border: '1px solid #93c4c8', padding: '12px', textAlign: 'center', fontSize: '12px', color: '#555', borderRadius: '10px' }}>
          <p style={{ margin: 0 }}>© 2026 CelSender • Desarrollado por <span style={{ color: '#5b9ea6', fontWeight: 'bold' }}>celiadigitalec</span></p>
        </footer>

        <a 
          href="https://wa.me/593939669413?text=Hola%20Celia,%20tengo%20una%20duda%20sobre%20CelSender" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#25D366', color: '#fff', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 1000, textDecoration: 'none' }}
        >
          <MessageCircle size={28} />
        </a>
      </div>
    );
  }

 // 1. Asegúrate de tener este estado arriba en tu componente junto a los demás useState:
const [selectedFilters, setSelectedFilters] = useState({});

// 2. Función de filtrado dinámico para todas las columnas:
const filteredExcelData = excelData.filter(row => {
  if (!selectedFilters || Object.keys(selectedFilters).length === 0) return true;
  
  return Object.keys(selectedFilters).every(col => {
    const filterVal = selectedFilters[col];
    if (!filterVal || filterVal === 'TODOS') return true;
    return String(row[col] || '').trim() === String(filterVal).trim();
  });
});

// --- EN TU VISTA (JSX), DENTRO DEL PASO 1 ---
{currentStep === 1 && (
  <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <FileSpreadsheet size={18} style={{ color: '#5b9ea6' }} />
      <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#5b9ea6' }}>Cargar Excel de Contactos</h2>
    </div>

    {/* Input para subir el archivo */}
    <div>
      <input 
        type="file" 
        accept=".xlsx, .xls, .csv" 
        onChange={handleFileUpload} 
        style={{ fontSize: '11px', color: '#2c3e40' }} 
      />
    </div>

    {/* FILTROS DINÁMICOS PARA TODAS LAS COLUMNAS DEL EXCEL */}
    {excelColumns.length > 0 && (
      <div style={{ backgroundColor: '#faf8f5', padding: '12px', borderRadius: '8px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#5b9ea6' }}>
          🎯 Segmentar envíos ({filteredExcelData.length} de {excelData.length} seleccionados):
        </span>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
          {excelColumns.map((col) => {
            const uniqueValues = ['TODOS', ...new Set(excelData.map(row => row[col]).filter(val => val !== undefined && val !== null && val !== ''))];
            
            return (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Filtrar por {col}:
                </label>
                <select
                  value={selectedFilters?.[col] || 'TODOS'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedFilters(prev => ({
                      ...(prev || {}),
                      [col]: val
                    }));
                  }}
                  style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #93c4c8', backgroundColor: '#ffffff', fontSize: '11px', color: '#2c3e40', outline: 'none', boxSizing: 'border-box' }}
                >
                  {uniqueValues.map(val => (
                    <option key={val} value={val}>{val === 'TODOS' ? `📋 Todos (${col})` : val}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    )}

    <button
      onClick={() => {
        if (excelData.length === 0) { alert('Sube un archivo Excel primero.'); return; }
        if (filteredExcelData.length === 0) { alert('No hay contactos que coincidan con esos filtros. Ajusta las opciones arriba.'); return; }
        setCurrentStep(2);
      }}
      style={{ width: '100%', backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}
    >
      <span>Continuar a Redactar ({filteredExcelData.length})</span>
      <ArrowRight size={14} />
    </button>
  </div>
)}

          {/* PASO 2: REDACTAR MENSAJE CON COLUMNAS DINÁMICAS */}
          {currentStep === 2 && (
            <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={18} style={{ color: '#5b9ea6' }} />
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#5b9ea6' }}>Plantilla con tus Columnas</h2>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#5b9ea6', display: 'block', marginBottom: '4px' }}>Toca para insertar tus columnas del Excel:</span>
                {excelColumns.length === 0 ? (
                  <p style={{ fontSize: '11px', color: '#e06d6d' }}>Sube un Excel en el Paso 1 para ver tus columnas.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '80px', overflowY: 'auto' }}>
                    {excelColumns.map((col) => (
                      <button
                        key={col}
                        onClick={() => insertVariable(col)}
                        style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', border: '1px solid #ebd1a6', cursor: 'pointer' }}
                      >
                        +{col}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#5b9ea6', display: 'block', marginBottom: '4px' }}>Redacta tu mensaje:</span>
                <textarea
                  rows="4"
                  placeholder="Ej: Hola {Nombre}, tienes una deuda de {Deuda} y {Puntos} acumulados..."
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #93c4c8', backgroundColor: '#faf8f5', fontSize: '12px', outline: 'none', color: '#2c3e40', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #86efac' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#166534', display: 'block', marginBottom: '3px' }}>
                  👁️ Vista previa (Primer contacto seleccionado):
                </span>
                <p style={{ margin: 0, fontSize: '11px', color: '#14532d', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>
                  {previewMessage || <span style={{ color: '#888', fontStyle: 'italic' }}>Escribe algo arriba...</span>}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setCurrentStep(1)}
                  style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', border: '1px solid #ebd1a6', padding: '9px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ArrowLeft size={14} />
                  <span>Atrás</span>
                </button>
                <button
                  onClick={() => {
                    if (filteredExcelData.length === 0) { alert('No hay contactos seleccionados.'); setCurrentStep(1); return; }
                    if (!messageTemplate.trim()) { alert('Por favor escribe un mensaje antes de continuar.'); return; }
                    setCurrentStep(3);
                  }}
                  style={{ flex: 1, backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '9px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>Ir a Envíos ({filteredExcelData.length})</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: ENVÍO DE MENSAJES */}
          {currentStep === 3 && (
            <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={18} style={{ color: '#5b9ea6' }} />
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#5b9ea6' }}>Centro de Envíos</h2>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#5b9ea6' }}>
                  {sentCount} / {totalContacts} enviados ({progressPercent}%)
                </span>
              </div>

              {/* Barra de Progreso */}
              <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, backgroundColor: '#5b9ea6', height: '100%', transition: 'width 0.3s ease' }} />
              </div>

              {/* Lista de Contactos Filtrados para Enviar */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid #ddd', padding: '8px', borderRadius: '8px', backgroundColor: '#faf8f5' }}>
                {filteredExcelData.map((row, index) => {
                  const keys = Object.keys(row);
                  
                  // Búsqueda segura de teléfono
                  const phoneKey = keys.find(k => {
                    const lower = k.toLowerCase();
                    return lower.includes('cel') || lower.includes('tel') || lower.includes('phone') || lower.includes('numero') || lower.includes('whatsapp');
                  }) || keys[0];
                  
                  const rawPhone = row[phoneKey] ? String(row[phoneKey]).trim().replace(/\D/g, '') : '';
                  const finalPhone = rawPhone.startsWith(countryCode) ? rawPhone : `${countryCode}${rawPhone.replace(/^0/, '')}`;
                  
                  // Búsqueda segura del nombre real desde el Excel
                  const nameKey = keys.find(k => {
                    const lower = k.toLowerCase();
                    return lower.includes('nom') || lower.includes('cli') || lower.includes('name') || lower.includes('persona') || lower.includes('razon');
                  }) || keys.find(k => k !== phoneKey && String(row[k]).trim() !== '') || keys[0];
                  
                  const clientName = row[nameKey] ? String(row[nameKey]) : `Contacto ${index + 1}`;
                  
                  const isSent = sentStatuses[index];
                  const message = getProcessedMessage(row);
                  const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;

                  return (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: isSent ? '#f0fdf4' : '#ffffff', borderRadius: '6px', border: '1px solid', borderColor: isSent ? '#86efac' : '#ddd', fontSize: '11px' }}>
                      <div style={{ overflow: 'hidden', marginRight: '8px', flex: 1 }}>
                        <strong style={{ color: '#2c3e40', display: 'block', fontSize: '12px' }}>👤 {clientName}</strong>
                        <span style={{ color: '#5b9ea6', fontSize: '10px', display: 'block' }}>+{finalPhone}</span>
                        <p style={{ margin: '3px 0 0 0', fontSize: '10px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          💬 "{message || 'Escribe un mensaje...'}"
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            if (!loggedPhone) {
                              alert('⚠️ Sesión no válida. Por favor vuelve a ingresar con tu número autorizado.');
                              setIsAuthenticated(false);
                              return;
                            }
                            window.open(whatsappUrl, '_blank');
                            setSentStatuses(prev => ({ ...prev, [index]: true }));
                          }}
                          style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', whiteSpace: 'nowrap' }}
                        >
                          <Send size={12} />
                          <span>{isSent ? 'Reenviar' : 'Enviar'}</span>
                        </button>
                        {isSent && <CheckCircle2 size={16} style={{ color: '#166534' }} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setCurrentStep(2)}
                  style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', border: '1px solid #ebd1a6', padding: '9px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ArrowLeft size={14} />
                  <span>Atrás</span>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('¿Deseas reiniciar el progreso de envíos?')) {
                      setSentStatuses({});
                      localStorage.removeItem('celsender_progress');
                    }
                  }}
                  style={{ flex: 1, backgroundColor: '#e06d6d', color: '#ffffff', border: 'none', padding: '9px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <RotateCcw size={14} />
                  <span>Reiniciar Progreso</span>
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      <footer style={{ backgroundColor: '#ffffff', border: '1px solid #93c4c8', padding: '10px', textAlign: 'center', fontSize: '11px', color: '#555', borderRadius: '8px' }}>
        <p style={{ margin: 0 }}>© 2026 CelSender • Desarrollado por <span style={{ color: '#5b9ea6', fontWeight: 'bold' }}>celiadigitalec</span></p>
      </footer>

      <a 
        href="https://wa.me/593939669413?text=Hola%20Celia,%20tengo%20una%20duda%20sobre%20CelSender" 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#25D366', color: '#fff', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 1000, textDecoration: 'none' }}
      >
        <MessageCircle size={28} />
      </a>
    </div>
  );
}