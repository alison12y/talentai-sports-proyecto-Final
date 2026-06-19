function PlayersPage() {
  return (
    <section className="page page-fluid">
      <div className="page-header">
        <div>
          <p className="eyebrow">Jugadores</p>
          <h1>Jugadores</h1>
          <p>Registra perfiles deportivos, datos familiares y pertenencia a equipos.</p>
        </div>
        <button type="button" className="button-primary">Nuevo jugador</button>
      </div>

      <div className="table-placeholder">
        <div>
          <strong>Listado de jugadores</strong>
          <p>Base visual para una tabla con estado, posicion, equipo y acciones.</p>
        </div>
        <span className="status-pill">Registro</span>
      </div>
    </section>
  )
}

export default PlayersPage
