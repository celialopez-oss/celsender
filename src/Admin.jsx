import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, UserPlus, Trash2, Calendar, LogOut } from 'lucide-react';

const SUPABASE_URL = "https://zbqgwwkhxjxfmzmltglm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_G_Vvo4v1DFXFJy-ojrCLZA_rCbLPSeP"; 
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function AdminPanel() {
  const [isLogged, setIsLogged] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  const [users, setUsers] = useState([]);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  
  // Fecha por defecto: hoy + 1 mes exacto (puedes cambiarla libremente en el calendario)
  const getDefaultExpiry = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  };

  const [expiryDateInput, setExpiryDateInput] = useState(getDefaultExpiry());

  const MASTER_ADMIN_PASS = "celia2026"; 

  useEffect(() => {
    if (isLogged) {
      fetchUsers();
    }
  }, [isLogged]);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('authorized_users').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error al cargar usuarios:', error);
    } else {
      setUsers(data || []);
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!clientPhone || !clientName || !expiryDateInput) return;

    const cleanPhone = clientPhone.trim().replace(/^0/, '');
    // Convertir la fecha seleccionada a formato ISO para Supabase
    const finalExpiryDate = new Date(expiryDateInput + 'T23:59:59').toISOString();

    const { error } = await supabase.from('authorized_users').insert([
      {
        client_name: clientName,
        phone: cleanPhone,
        expiry_date: finalExpiryDate,
        is_active: true
      }
    ]);

    if (error) {
      alert('Error al registrar usuario: ' + error.message);
    } else {
      alert(`¡Cliente ${clientName} autorizado hasta el ${new Date(finalExpiryDate).toLocaleDateString()}!`);
      setClientName('');
      setClientPhone('');
      fetchUsers();
    }
  };

  const handleDeleteClient = async (id) => {
    if (window.confirm('¿Estás segura de eliminar la licencia de este usuario?')) {
      const { error } = await supabase.from('authorized_users').delete().eq('id', id);
      if (error) {
        alert('Error al eliminar: ' + error.message);
      } else {
        fetchUsers();
      }
    }
  };

  if (!isLogged) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#faf8f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: '360px', backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #93c4c8', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <h2 style={{ color: '#5b9ea6', margin: 0, fontSize: '18px' }}>👑 CelSender Admin</h2>
            <p style={{ fontSize: '12px', color: '#666' }}>Panel de Control de Licencias</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if(adminPassword === MASTER_ADMIN_PASS) setIsLogged(true); else alert('Contraseña incorrecta'); }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="password"
              placeholder="Contraseña de Administradora"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #93c4c8', fontSize: '12px', outline: 'none' }}
              required
            />
            <button type="submit" style={{ backgroundColor: '#5b9ea6', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Ingresar al Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#faf8f5', padding: '20px', fontFamily: 'system-ui, sans-serif', color: '#2c3e40' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Header */}
        <div style={{ backgroundColor: '#fff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #93c4c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', color: '#5b9ea6' }}>CelSender • Gestión de Clientes</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Registra números y elige la fecha exacta de vencimiento</p>
          </div>
          <button onClick={() => setIsLogged(false)} style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', border: '1px solid #ebd1a6', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <LogOut size={14} /> Salir
          </button>
        </div>

        {/* Formulario para Crear Licencia con Fecha Manual */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #93c4c8' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#5b9ea6', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserPlus size={16} /> Nueva Autorización
          </h3>
          <form onSubmit={handleAddClient} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px auto', gap: '10px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Nombre Cliente:</label>
              <input type="text" placeholder="Ej: María Pérez" value={clientName} onChange={(e) => setClientName(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #93c4c8', fontSize: '11px', boxSizing: 'border-box' }} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Número (con país):</label>
              <input type="text" placeholder="Ej: 593991112223" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #93c4c8', fontSize: '11px', boxSizing: 'border-box' }} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Fecha Caducidad:</label>
              <input type="date" value={expiryDateInput} onChange={(e) => setExpiryDateInput(e.target.value)} style={{ width: '100%', padding: '7px', borderRadius: '8px', border: '1px solid #93c4c8', fontSize: '11px', backgroundColor: '#fff', boxSizing: 'border-box' }} required />
            </div>
            <button type="submit" style={{ backgroundColor: '#5b9ea6', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
              Autorizar
            </button>
          </form>
        </div>

        {/* Tabla de Licencias Registradas */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #93c4c8' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#5b9ea6', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={16} /> Clientes Autorizados ({users.length})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#faf8f5', borderBottom: '1px solid #93c4c8', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Cliente</th>
                  <th style={{ padding: '8px' }}>Teléfono</th>
                  <th style={{ padding: '8px' }}>Vencimiento</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isExpired = u.expiry_date && new Date(u.expiry_date) < new Date();
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{u.client_name || 'Sin nombre'}</td>
                      <td style={{ padding: '8px' }}>+{u.phone}</td>
                      <td style={{ padding: '8px' }}>
                        {u.expiry_date ? (
                          <span style={{ backgroundColor: isExpired ? '#fde8e8' : '#e6f4ea', color: isExpired ? '#9b1c1c' : '#137333', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }}>
                            {isExpired ? 'Vencido 🔴' : `Hasta ${new Date(u.expiry_date).toLocaleDateString()} 🟢`}
                          </span>
                        ) : (
                          <span style={{ color: '#888' }}>Permanente</span>
                        )}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button onClick={() => handleDeleteClient(u.id)} title="Eliminar acceso" style={{ background: 'none', border: 'none', color: '#e06d6d', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No hay usuarios autorizados registrados aún.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}