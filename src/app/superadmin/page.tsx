'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  esSuperAdmin, subscribeTenants, actualizarTenant, cambiarStatusTenant, obtenerCantidadPerfiles,
  type Tenant,
} from '@/lib/tenants'

export default function SuperAdminPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [cantidadPerfiles, setCantidadPerfiles] = useState<Record<string, number>>({})
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<Tenant | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    esSuperAdmin(user.uid).then(setAutorizado)
  }, [authLoading, user, router])

  useEffect(() => {
    if (!autorizado) return
    return subscribeTenants(setTenants)
  }, [autorizado])

  useEffect(() => {
    tenants.forEach(t => {
      if (cantidadPerfiles[t.uid] !== undefined) return
      obtenerCantidadPerfiles(t.uid).then(n => setCantidadPerfiles(prev => ({ ...prev, [t.uid]: n })))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants])

  if (authLoading || autorizado === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500" />
      </div>
    )
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
          <h1 className="text-lg font-bold text-white">No autorizado</h1>
          <p className="text-sm text-slate-400">Esta cuenta no tiene acceso al panel de administración.</p>
          <button
            onClick={() => logout().then(() => router.replace('/login'))}
            className="text-sm font-medium text-slate-400 hover:text-white transition"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  const filtrados = tenants.filter(t => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return t.nombre.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || t.telefono.includes(q)
  })

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold">RickyMath — Superadmin</h1>
            <p className="text-sm text-slate-500">{tenants.length} cuenta{tenants.length !== 1 ? 's' : ''} registrada{tenants.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => logout().then(() => router.replace('/login'))}
            className="text-sm font-medium text-slate-400 hover:text-white transition"
          >
            Cerrar sesión
          </button>
        </div>

        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono…"
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800">
                  <th className="px-4 py-3 font-medium">Padre/tutor</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Hijos</th>
                  <th className="px-4 py-3 font-medium">Registrado</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(t => (
                  <FilaTenant
                    key={t.uid}
                    tenant={t}
                    cantidadHijos={cantidadPerfiles[t.uid]}
                    onEditar={() => setEditando(t)}
                  />
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      {tenants.length === 0 ? 'Todavía no hay cuentas registradas.' : 'Sin resultados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editando && <ModalEditar tenant={editando} onCerrar={() => setEditando(null)} />}
    </div>
  )
}

function FilaTenant({ tenant, cantidadHijos, onEditar }: {
  tenant: Tenant; cantidadHijos: number | undefined; onEditar: () => void
}) {
  const [cambiandoStatus, setCambiandoStatus] = useState(false)
  const fecha = tenant.creadoEn?.toDate?.()
  const fechaTexto = fecha ? fecha.toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  async function toggleStatus() {
    setCambiandoStatus(true)
    try {
      await cambiarStatusTenant(tenant.uid, tenant.status === 'active' ? 'suspended' : 'active')
    } finally {
      setCambiandoStatus(false)
    }
  }

  return (
    <tr className="border-b border-slate-800/60 last:border-0">
      <td className="px-4 py-3 font-medium text-white">{tenant.nombre || '—'}</td>
      <td className="px-4 py-3 text-slate-400">
        <div>{tenant.email}</div>
        {tenant.telefono && <div className="text-xs text-slate-500">{tenant.telefono}</div>}
      </td>
      <td className="px-4 py-3 text-slate-400">{cantidadHijos ?? '…'}</td>
      <td className="px-4 py-3 text-slate-400">{fechaTexto}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          tenant.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
        }`}>
          {tenant.status === 'active' ? 'Activo' : 'Suspendido'}
        </span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <button onClick={onEditar} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition mr-3">
          Editar
        </button>
        <button
          onClick={toggleStatus}
          disabled={cambiandoStatus}
          className={`text-xs font-medium transition disabled:opacity-50 ${
            tenant.status === 'active' ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'
          }`}
        >
          {tenant.status === 'active' ? 'Suspender' : 'Reactivar'}
        </button>
      </td>
    </tr>
  )
}

function ModalEditar({ tenant, onCerrar }: { tenant: Tenant; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(tenant.nombre)
  const [email, setEmail] = useState(tenant.email)
  const [telefono, setTelefono] = useState(tenant.telefono)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      await actualizarTenant(tenant.uid, { nombre, email, telefono })
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <h2 className="text-base font-bold text-white">Editar cuenta</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Nombre</label>
            <input
              value={nombre} onChange={e => setNombre(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
            <input
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Teléfono</label>
            <input
              value={telefono} onChange={e => setTelefono(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={onCerrar}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
