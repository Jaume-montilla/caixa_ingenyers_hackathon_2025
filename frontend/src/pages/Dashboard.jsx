import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import "./Dashboard.css";

const Dashboard = () => {
  const svgRef = useRef(null);
  const [status, setStatus] = useState("Cargando...");
  const [error, setError] = useState(null);

  useEffect(() => { 
    const containerWidth = svgRef.current.parentElement.clientWidth;
    const containerHeight = svgRef.current.parentElement.clientHeight;
    const width = containerWidth || 1400;
    const height = containerHeight || 900;
 
    d3.select(svgRef.current).selectAll("*").remove();
 
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("width", "100%")
      .attr("height", "100%")
      .style("background", "#cfd3d4")
      .style("border-radius", "15px");
 
    const loadingText = svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "24px")
      .attr("fill", "#666")
      .text("Cargando mapa de España...");
 
    const url = "https://cdn.jsdelivr.net/npm/es-atlas/es/municipalities.json"; 
    
    d3.json(url)
      .then(es => {         
        loadingText.text("Procesando municipios...");
        setStatus("Procesando municipios...");
         
        const municipalities = topojson.feature(es, es.objects.municipalities);
        const national = topojson.merge(es, es.objects.municipalities.geometries);

        loadingText.remove();
        setStatus(`${municipalities.features.length} municipios cargados`);
  
        const canarias = municipalities.features.filter(d => {
          const centroid = d3.geoCentroid(d);
          const lon = centroid[0];
          const lat = centroid[1]; 
          return lon < -13 && lon > -19 && lat > 27 && lat < 30;
        });
        
        const peninsula = municipalities.features.filter(d => {
          const centroid = d3.geoCentroid(d);
          const lon = centroid[0];
          const lat = centroid[1];
          return !(lon < -13 && lon > -19 && lat > 27 && lat < 30);
        });

        const peninsulaCollection = {
          type: "FeatureCollection",
          features: peninsula
        };
 
        // Ajustar el mapa con padding para que no esté tan al límite
        const projection = d3.geoIdentity()
          .reflectY(true)
          .fitExtent([[30, 30], [width - 30, height - 30]], peninsulaCollection);

        const path = d3.geoPath(projection);
  
        svg.append("g")
          .attr("class", "peninsula-group")
          .selectAll("path")
          .data(peninsula)
          .join("path")
          .attr("fill", "white")
          .attr("d", path)
          .attr("stroke", "black") 
          .attr("stroke-width", 0.2)
          .on("mouseover", function(event, d) {
            d3.select(this)
              .attr("fill", "#FFC107")
              .attr("stroke-width", 1);
            
            const municipioName = d.properties.name || d.properties.NAME_2; 
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("fill", "white")
              .attr("stroke-width", 0.2);
          })
          .append("title")
          .text(d => d.properties.name || d.properties.NAME_2);
  
        const canariasCollection = {
          type: "FeatureCollection",
          features: canarias
        };
 
        const canariasProjection = d3.geoIdentity()
          .reflectY(true)
          .fitSize([180, 130], canariasCollection);  

        const canariasPath = d3.geoPath(canariasProjection);
 
        const canariasGroup = svg.append("g")
          .attr("class", "canarias-group")
          .attr("transform", "translate(" + (10) + ", " + (height - 130) + ")");
  
        canariasGroup.append("line")
          .attr("x1", -20)
          .attr("y1", -5)
          .attr("x2", 185)
          .attr("y2", -5)
          .attr("stroke", "black")
          .attr("stroke-width", 2);
        
        canariasGroup.append("line")
          .attr("x1", 185)
          .attr("y1", -5)
          .attr("x2", 185)
          .attr("y2", 135)
          .attr("stroke", "black")
          .attr("stroke-width", 2);
 
        canariasGroup.selectAll("path")
          .data(canarias)
          .join("path")
          .attr("fill", "white")
          .attr("d", canariasPath)
          .attr("stroke", "black")
          .attr("stroke-width", 0.3)
          .on("mouseover", function(event, d) {
            d3.select(this)
              .attr("fill", "#FFC107")
              .attr("stroke-width", 1);
            
            const municipioName = d.properties.name || d.properties.NAME_2;
            console.log("Mouse sobre municipio (Canarias):", municipioName);
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("fill", "white")
              .attr("stroke-width", 0.3);
          })
          .append("title")
          .text(d => d.properties.name || d.properties.NAME_2);
 
        canariasGroup.append("text")
          .attr("x", 100)
          .attr("y", -10)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("font-weight", "bold") ;

      })
      .catch(error => { 
        
        loadingText
          .attr("fill", "red")
          .text(`Error: ${error.message}`);
        
        setError(error.message);
        setStatus("Error al cargar el mapa");
      });

  }, []);

  return (
    <div className="dashboard-container">
      <nav className="dashboard-header" style={{
        border: '2px solid #363636f9',
        margin: '15px',
        borderRadius: '10px'
      }}>
        <h1>Dashboard de Municipios de España</h1>
        <p>{status}</p>
      </nav>
      
      {error && (
        <div className="dashboard-error">
          Error: {error}
        </div>
      )}
      <div style={{
        flex: 1,
        display: 'flex',
        margin: '0 15px 15px 15px',
      }}>
        <div className="dashboard-map-container">
          <svg ref={svgRef}></svg>
        </div>
        <div style={{
          marginLeft: '15px',
          border: '2px solid #363636f9',
          borderRadius: '10px',
          width: '25%',
          backgroundColor: 'white'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', padding: '10px 20px' }}>Información del Municipio</h2>
          <form action="">
            <div style={{ padding: '10px 20px' }}>
              <label htmlFor="municipio-slider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span>Porcentaje</span>
                <span className="percent-output" style={{ fontWeight: '700' }}>50%</span>
              </label>

              <input
                id="municipio-slider"
                type="range"
                min="0"
                max="100"
                defaultValue="50"
                onInput={(e) => {
                  const v = e.target.value;
                  const form = e.target.closest('form');
                  const out = form && form.querySelector('.percent-output');
                  const fill = form && form.querySelector('.progress-fill');
                  if (out) out.textContent = v + '%';
                  if (fill) fill.style.width = v + '%';
                }}
                style={{ width: '100%' }}
              /> 
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
