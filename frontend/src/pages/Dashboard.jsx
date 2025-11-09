import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import "./Dashboard.css";
import { data } from "react-router-dom";

const Dashboard = () => {
  const svgRef = useRef(null);
  const [status, setStatus] = useState("Cargando...");
  const [error, setError] = useState(null);
  const [tipoMapa, setTipoMapa] = useState("poblacion");
  const [mapInfo, setMapInfo] = useState([]);
  const [topoData, setTopoData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTopModal, setShowTopModal] = useState(false);
  const [top3Municipios, setTop3Municipios] = useState([]);
  const percentatgeMapa = 0.93;

  const colores = {
    "numero_oficinas": [
      "#f7fbff",
      "#deebf7",
      "#c6dbef",
      "#9ecae1",
      "#6baed6",
      "#4292c6",
      "#2171b5",
      "#08519c",
      "#08306b",
      "#041836"
    ],
    "sueldo_medio": [
      "#fff5eb",
      "#fee6ce",
      "#fdd0a2",
      "#fdae6b",
      "#fd8d3c",
      "#f16913",
      "#d94801",
      "#a63603",
      "#7f2704",
      "#4d1702"
    ],
    "precio_alquiler": [
      "#f7fcf5",
      "#e5f5e0",
      "#c7e9c0",
      "#a1d99b",
      "#74c476",
      "#41ab5d",
      "#238b45",
      "#006d2c",
      "#00441b",
      "#002d12"
    ],
    "edad_media": [
      "#fff7f3",
      "#fde0dd",
      "#fcc5c0",
      "#fa9fb5",
      "#f768a1",
      "#dd3497",
      "#ae017e",
      "#7a0177",
      "#49006a",
      "#2d0041"
    ],
    "poblacion": [
      "#f7fcfd",
      "#e0ecf4",
      "#bfd3e6",
      "#9ebcda",
      "#8c96c6",
      "#8c6bb1",
      "#88419d",
      "#810f7c",
      "#4d004b",
      "#2b0028"
    ],
    "incremento_poblacion": [
      "#fff7ec",
      "#fee8c8",
      "#fdd49e",
      "#fdbb84",
      "#fc8d59",
      "#ef6548",
      "#d7301f",
      "#b30000",
      "#7f0000",
      "#4a0000"
    ]
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      impactoSocial: parseFloat(formData.get('impacto-social')) || 50,
      impactoEconomico: parseFloat(formData.get('impacto-economico')) || 50,
      edadMin: parseInt(formData.get('edad-min')) || 18,
      edadMax: parseInt(formData.get('edad-max')) || 65,
      tipoMapa: tipoMapa
    };

    try {
      setIsLoading(true);
      setStatus('Filtrando municipios relevantes...');

      // FILTRADO PREVIO: Reducir municipios antes de enviar a IA
      const municipiosFiltrados = mapInfo.filter(m => {
        // Solo municipios con datos completos
        if (!m.poblacion || !m.num_oficinas) return false;
        
        // Filtro por edad media si está disponible
        if (m.edad_media) {
          const edadRangoMin = data.edadMin - 5; // Margen de 5 años
          const edadRangoMax = data.edadMax + 5;
          if (m.edad_media < edadRangoMin || m.edad_media > edadRangoMax) return false;
        }
        
        // Solo municipios con al menos 1 oficina
        if (m.num_oficinas < 1) return false;
        
        // Población mínima razonable (ej: 1000 habitantes)
        if (m.poblacion < 1000) return false;
        
        return true;
      });

      console.log(`Municipios filtrados: ${municipiosFiltrados.length} de ${mapInfo.length}`);
      
      // Ordenar por un score simple antes de enviar a IA
      const municipiosOrdenados = municipiosFiltrados.map(m => {
        let score = 0;
        
        // Score basado en impacto social (población, incremento población)
        if (m.poblacion) score += (data.impactoSocial / 100) * Math.log10(m.poblacion);
        if (m.increment_poblacio) score += (data.impactoSocial / 100) * m.increment_poblacio;
        
        // Score basado en impacto económico (sueldo medio, oficinas)
        if (m.sueldo_medio) score += (data.impactoEconomico / 100) * (m.sueldo_medio / 1000);
        if (m.num_oficinas) score += (data.impactoEconomico / 100) * m.num_oficinas * 10;
        
        return { ...m, score };
      }).sort((a, b) => b.score - a.score);

      // Tomar solo los top 300 municipios para enviar a la IA
      const topMunicipios = municipiosOrdenados.slice(0, 300);
      
      console.log('Enviando top 300 municipios a la IA...');
      setStatus('Enviando top 300 municipios a la IA...');
 
      const paqueteSize = 100;
      const paquetes = [];
      for (let i = 0; i < topMunicipios.length; i += paqueteSize) {
        paquetes.push(topMunicipios.slice(i, i + paqueteSize));
      }

      const mejoresPorPaquete = [];

      for (let i = 0; i < paquetes.length; i++) {
        setStatus(`Analizando paquete ${i + 1} de ${paquetes.length}...`);
       
                console.log( `Analiza estos municipios y devuelve el MEJOR según estos criterios:
              - Impacto Social (${data.impactoSocial}%): Población, incremento población, edad media cerca de ${data.edadMin}-${data.edadMax} años
              - Impacto Económico (${data.impactoEconomico}%): Sueldo medio, número de oficinas, precio alquiler
              
              Devuelve SOLO un objeto JSON:
              {
                "municipio": { ...el objeto completo del municipio ganador... },
                "puntuacion": número 0-100,
                "razon": "breve explicación"
              }
              
              Municipios: ${JSON.stringify(paquetes[i])}`)


        const response = await fetch('http://localhost:3001/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: {
              "role": "user",
              "content": `Analiza estos municipios y devuelve el MEJOR según estos criterios:
              - Impacto Social (${data.impactoSocial}%): Población, incremento población, edad media cerca de ${data.edadMin}-${data.edadMax} años
              - Impacto Económico (${data.impactoEconomico}%): Sueldo medio, número de oficinas, precio alquiler
              
              Devuelve SOLO un objeto JSON:
              {
                "municipio": { ...el objeto completo del municipio ganador... },
                "puntuacion": número 0-100,
                "razon": "breve explicación"
              }
              
              Municipios: ${JSON.stringify(paquetes[i])}`
            }, 
          })
        });
        if (!response.ok) {
          console.warn(`Error en paquete ${i + 1}: ${response.statusText}`);
          continue;
        }

        const resultado = await response.json();
        
        // Parsear respuesta del paquete
        let mejorPaquete = null;
        if (resultado.choices && resultado.choices[0]?.message?.content) {
          const content = resultado.choices[0].message.content;
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          mejorPaquete = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } else if (typeof resultado === 'object' && resultado.municipio) {
          mejorPaquete = resultado;
        }
        
        if (mejorPaquete) {
          mejoresPorPaquete.push(mejorPaquete);
        }
      }
 
      setStatus('Seleccionando los 3 mejores municipios...');
      
      const responseFinal = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            "role": "user",
            "content": `De estos ${mejoresPorPaquete.length} finalistas, selecciona los 3 MEJORES según:
            - Impacto Social: ${data.impactoSocial}%
            - Impacto Económico: ${data.impactoEconomico}%
            - Edad: ${data.edadMin} - ${data.edadMax} años
            
            Devuelve SOLO un array JSON con 3 municipios:
            [
              {
                "municipio": { ...objeto completo... },
                "puntuacion": número 0-100,
                "razon": "explicación breve"
              }
            ]
            
            Candidatos: ${JSON.stringify(mejoresPorPaquete)}`
          },
        })
      });

      if (!responseFinal.ok) {
        throw new Error(`Error en selección final: ${responseFinal.statusText}`);
      }

      const resultado = await responseFinal.json();
       
      let top3;
      if (typeof resultado === 'string') { 
        const jsonMatch = resultado.match(/\[[\s\S]*\]/);
        top3 = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } else if (Array.isArray(resultado)) {
        top3 = resultado;
      } else if (resultado.choices && resultado.choices[0]?.message?.content) {
        const content = resultado.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        top3 = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } else {
        top3 = [];
      }
      
      console.log('Top 3 municipios:', top3);
       
      setTop3Municipios(top3);
      setShowTopModal(true);
      setStatus(`Análisis completado. Top 3 municipios encontrados.`);
      
      setIsLoading(false);
      
    } catch (error) {
      console.error('Error en análisis con IA:', error);
      setStatus('Error al analizar municipios');
      setIsLoading(false);
    }
  };

  const dateToSee = (municipioName, tipo, mapInfo) => {
    if (!mapInfo || !Array.isArray(mapInfo) || mapInfo.length === 0) return 'Datos no disponibles';
    
    const municipioNameSinAccento = municipioName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const municipioData = mapInfo.find(m => 
      m.nombre && municipioNameSinAccento && 
      m.nombre.toLowerCase().trim() === municipioNameSinAccento.toLowerCase().trim()
    );
    if (!municipioData) return 'Datos no disponibles';
    
    const fieldMap = {
      'poblacion': 'poblacion',
      'numero_oficinas': 'num_oficinas',
      'sueldo_medio': 'sueldo_medio',
      'precio_alquiler': 'precio_alquiler',
      'edad_media': 'edad_media',
      'incremento_poblacion': 'increment_poblacio'
    };
    
    const labelMap = {
      'poblacion': 'Población',
      'numero_oficinas': 'Número de oficinas',
      'sueldo_medio': 'Sueldo medio',
      'precio_alquiler': 'Precio alquiler medio',
      'edad_media': 'Edad media',
      'incremento_poblacion': 'Incremento población'
    };
    
    const field = fieldMap[tipo];
    const label = labelMap[tipo];
    const value = municipioData[field];
    
    if (value === undefined || value === null) return `${label}: Datos no disponibles`;
     
    const formattedValue = Math.round(value).toLocaleString('es-ES');
    return `${label}: ${formattedValue}`;
  }

  const getColorForMunicipio = (municipioName, tipo) => {
    if (!mapInfo || !Array.isArray(mapInfo) || mapInfo.length === 0) return '#e0e0e0';
    
    const municipioNameSinAccento = municipioName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const municipioData = mapInfo.find(m => 
      m.nombre && municipioNameSinAccento && 
      m.nombre.toLowerCase().trim() === municipioNameSinAccento.toLowerCase().trim()
    );
    
    if (!municipioData) { 
      return '#e0e0e0';
    }
    
    const fieldMap = {
      'poblacion': 'poblacion',
      'numero_oficinas': 'num_oficinas',
      'sueldo_medio': 'sueldo_medio',
      'precio_alquiler': 'precio_alquiler',
      'edad_media': 'edad_media',
      'incremento_poblacion': 'increment_poblacio'
    };
    
    const field = fieldMap[tipo];
    const value = municipioData[field];
    
    if (value === undefined || value === null || isNaN(value)) {
      return '#e0e0e0';
    }
     
    const valuesArray = mapInfo
      .map(m => m[field])
      .filter(v => v !== undefined && v !== null && !isNaN(v));
    
    if (valuesArray.length === 0) return '#e0e0e0';
     
    const sortedValues = [...valuesArray].sort((a, b) => a - b);
    const percentile95Index = Math.floor(sortedValues.length * percentatgeMapa);

    const max = sortedValues[percentile95Index];
    const min = sortedValues[0];
    
    if (min === max) {
      return colores[tipo][Math.floor(colores[tipo].length / 2)];
    }
     
    if (value > max) {
      return colores[tipo][colores[tipo].length - 1];
    }

    const scale = d3.scaleQuantize()
      .domain([min, max])
      .range(colores[tipo]);
    
    return scale(value);
  };

  useEffect(() => { 
    fetch('http://localhost:3001/municipio', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(response => response.json())
      .then(data => {
        console.log('Datos de municipios cargados:', data);
         
        const municipiosArray = data.municipioData || [];
        console.log('MapInfo es array:', Array.isArray(municipiosArray), 'Length:', municipiosArray.length);
        console.log('MinMax values:', data.minMaxValues);
        
        setMapInfo(municipiosArray);
      })
      .catch(error => {
        console.error('Error cargando datos de municipios:', error);
        setMapInfo([]);  
      });
 
    const url = "https://cdn.jsdelivr.net/npm/es-atlas/es/municipalities.json";
    d3.json(url)
      .then(es => {
        setTopoData(es);
      })
      .catch(error => {
        console.error('Error cargando TopoJSON:', error);
        setError(error.message);
      });
  }, []);
 
  useEffect(() => {
    if (!topoData || !mapInfo || mapInfo.length === 0) return; 
    setIsLoading(true);

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
 
    const mainGroup = svg.append("g").attr("class", "main-group");
 
    svg.call(d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [width, height]]) 
        .on("zoom", (event) => { 
          mainGroup.attr("transform", event.transform);
        })
      )
      .on("dblclick.zoom", null);  
 
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "map-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px 15px")
      .style("border-radius", "8px")
      .style("font-size", "14px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 1000)
      .style("box-shadow", "0 2px 10px rgba(0,0,0,0.3)")
      .style("transition", "opacity 0.2s");

    const municipalities = topojson.feature(topoData, topoData.objects.municipalities);
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
  
        const projection = d3.geoIdentity()
          .reflectY(true)
          .fitExtent([[30, 30], [width - 30, height - 30]], peninsulaCollection);

        const path = d3.geoPath(projection);
   
        svg.on("click", function(event) { 
          if (event.target.tagName === 'svg') {
            const [x, y] = d3.pointer(event);
            svg.transition().duration(750).call(
              d3.zoom().transform,
              d3.zoomIdentity.translate(width / 2, height / 2).scale(2).translate(-x, -y)
            );
          }
        });

        mainGroup
          .selectAll("path")
          .data(peninsula)
          .join("path")
          .attr("fill", d => {
            const municipioName = d.properties.name || d.properties.NAME_2;
            return getColorForMunicipio(municipioName, tipoMapa);
          })
          .attr("d", path)
          .attr("stroke", "black") 
          .attr("stroke-width", 0.2)
          .on("mouseover", function(event, d) {
            d3.select(this)
              .attr("stroke", "#FFC107")
              .attr("stroke-width", 1.5);
            
            const municipioName = d.properties.name || d.properties.NAME_2;

            tooltip
              .html(`
                <strong>${municipioName}</strong><br/>
                ${dateToSee(municipioName, tipoMapa, mapInfo)}
              `)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px")
              .style("opacity", 1);
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function(event, d) {
            d3.select(this)
              .attr("stroke", "black")
              .attr("stroke-width", 0.2);
            
            tooltip.style("opacity", 0);
          });
  
        const canariasCollection = {
          type: "FeatureCollection",
          features: canarias
        };
 
        const canariasProjection = d3.geoIdentity()
          .reflectY(true)
          .fitSize([180, 130], canariasCollection);  

        const canariasPath = d3.geoPath(canariasProjection);
 
        const canariasGroup = mainGroup.append("g")
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
          .attr("fill", d => {
            const municipioName = d.properties.name || d.properties.NAME_2;
            return getColorForMunicipio(municipioName, tipoMapa);
          })
          .attr("d", canariasPath)
          .attr("stroke", "black")
          .attr("stroke-width", 0.3)
          .on("mouseover", function(event, d) {
            d3.select(this)
              .attr("stroke", "#FFC107")
              .attr("stroke-width", 1.5);
            
            const municipioName = d.properties.name || d.properties.NAME_2;
            
            tooltip
              .html(`
                <strong>${municipioName}</strong><br/>
                ${dateToSee(municipioName, tipoMapa, mapInfo)}
              `)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px")
              .style("opacity", 1);
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function(event, d) {
            d3.select(this)
              .attr("stroke", "black")
              .attr("stroke-width", 0.3);
            
            tooltip.style("opacity", 0);
          });
 
        canariasGroup.append("text")
          .attr("x", 100)
          .attr("y", -10)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("font-weight", "bold");
 
        const legendWidth = 200;
        const legendHeight = 20;
        const legendGroup = svg.append("g")
          .attr("class", "legend")
          .attr("transform", `translate(40, 40)`);
 
        const labels = {
          'poblacion': 'Población',
          'numero_oficinas': 'Número de oficinas',
          'sueldo_medio': 'Sueldo medio (€)',
          'precio_alquiler': 'Precio alquiler (€/mes)',
          'edad_media': 'Edad media (años)',
          'incremento_poblacion': 'Incremento población (%)'
        };

        legendGroup.append("text")
          .attr("x", 0)
          .attr("y", -10)
          .attr("font-size", "14px")
          .attr("font-weight", "bold")
          .attr("fill", "#333")
          .text(labels[tipoMapa]);
 
        const fieldMap = {
          'poblacion': 'poblacion',
          'numero_oficinas': 'num_oficinas',
          'sueldo_medio': 'sueldo_medio',
          'precio_alquiler': 'precio_alquiler',
          'edad_media': 'edad_media',
          'incremento_poblacion': 'increment_poblacio'
        };
        
        const field = fieldMap[tipoMapa];
        const valuesArray = mapInfo
          .map(m => m[field])
          .filter(v => v !== undefined && v !== null && !isNaN(v));
        
        if (valuesArray.length > 0) {
          const min = Math.min(...valuesArray);
          const max = Math.max(...valuesArray);
 
          const gradient = svg.append("defs")
            .append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "0%");

          colores[tipoMapa].forEach((color, i) => {
            gradient.append("stop")
              .attr("offset", `${(i / (colores[tipoMapa].length - 1)) * 100}%`)
              .attr("stop-color", color);
          });
 
          legendGroup.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#legend-gradient)")
            .attr("stroke", "#333")
            .attr("stroke-width", 1);
 
          legendGroup.append("text")
            .attr("x", 0)
            .attr("y", legendHeight + 15)
            .attr("font-size", "12px")
            .attr("fill", "#333")
            .attr("font-weight", "bold")
            .text(min.toLocaleString('es-ES'));

          legendGroup.append("text")
            .attr("x", legendWidth)
            .attr("y", legendHeight + 15)
            .attr("text-anchor", "end")
            .attr("font-size", "12px")
            .attr("fill", "#333")
            .attr("font-weight", "bold")
            .text('>' + mapInfo?.map(m => m[field]).sort((a, b) => a - b)[Math.floor(mapInfo?.map(m => m[field]).length * percentatgeMapa)]?.toLocaleString('es-ES'));
        }
 
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
 
    return () => {
      d3.selectAll(".map-tooltip").remove();
    };

  }, [topoData, mapInfo, tipoMapa]);

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
 
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '40px 60px',
            borderRadius: '15px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '6px solid #f3f3f3',
              borderTop: '6px solid #363636f9',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#363636f9' }}>
              Cargando mapa...
            </h2>
            <p style={{ margin: '10px 0 0', color: '#666' }}>
              Por favor espera
            </p>
          </div>
        </div>
      )}

      <div style={{
        flex: 1,
        display: 'flex',
        margin: '0 15px 15px 15px',
      }}>
        <div className="dashboard-map-container" style={{ position: 'relative' }}>
          <svg ref={svgRef}></svg>
          
          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            backgroundColor: 'white',
            padding: '15px',
            borderRadius: '10px',
            border: '2px solid #363636f9',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 10
          }}>
            <label htmlFor="tipo-mapa" style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Tipo de Mapa
            </label>
            <select 
              id="tipo-mapa"
              value={tipoMapa}
              onChange={(e) => setTipoMapa(e.target.value)}
              style={{
                width: '200px',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="numero_oficinas">Número de oficinas</option>
              <option value="sueldo_medio">Sueldo medio</option>
              <option value="precio_alquiler">Precio alquiler medio</option>
              <option value="edad_media">Edad media</option>
              <option value="poblacion">Población</option>
              <option value="incremento_poblacion">Incremento población</option>
            </select>
          </div>

        </div>
        <div style={{
          marginLeft: '15px',
          border: '2px solid #363636f9',
          borderRadius: '10px',
          width: '25%',
          backgroundColor: 'white'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', padding: '10px 20px' }}>Información del Municipio</h2>
          <form action="" style={{ padding: '10px 20px' }} onSubmit={handleSubmit}>
            
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="impacto-social-slider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span>Impacto social</span>
                <span className="social-output" style={{ fontWeight: '700' }}>50%</span>
              </label>
              <input
                id="impacto-social-slider"
                name="impacto-social"
                type="range"
                min="0"
                max="100"
                defaultValue="50"
                onInput={(e) => {
                  const v = e.target.value;
                  const form = e.target.closest('form');
                  const out = form && form.querySelector('.social-output');
                  if (out) out.textContent = v + '%'; 
                }}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="impacto-economico-slider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span>Impacto económico</span>
                <span className="economic-output" style={{ fontWeight: '700' }}>50%</span>
              </label>
              <input
                id="impacto-economico-slider"
                name="impacto-economico"
                type="range"
                min="0"
                max="100"
                defaultValue="50"
                onInput={(e) => {
                  const v = e.target.value;
                  const form = e.target.closest('form');
                  const out = form && form.querySelector('.economic-output');
                  if (out) out.textContent = v + '%'; 
                }}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="rango-edad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span>Rango de edad</span>
                <span className="edad-output" style={{ fontWeight: '700' }}>18-65 años</span>
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  id="edad-min"
                  name="edad-min"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue="18"
                  onInput={(e) => {
                    const form = e.target.closest('form');
                    const minVal = e.target.value;
                    const maxVal = form.querySelector('#edad-max').value;
                    const out = form && form.querySelector('.edad-output');
                    if (out) out.textContent = `${minVal}-${maxVal} años`;
                  }}
                  style={{ width: '45%', padding: '5px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                <span>-</span>
                <input
                  id="edad-max"
                  name="edad-max"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue="65"
                  onInput={(e) => {
                    const form = e.target.closest('form');
                    const minVal = form.querySelector('#edad-min').value;
                    const maxVal = e.target.value;
                    const out = form && form.querySelector('.edad-output');
                    if (out) out.textContent = `${minVal}-${maxVal} años`;
                  }}
                  style={{ width: '45%', padding: '5px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
              </div>
            </div>

            <button 
              type="submit" 
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#363636f9',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.3s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#4a4a4a'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#363636f9'}
            >
              Enviar
            </button>

            <hr></hr>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="rango-desviacion" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span>Desviación estándar del mapa</span>
                <span className="desviacion-output" style={{ fontWeight: '700' }}>93%</span>
              </label>  
                <input
                  id="desviacion"
                  name="desviacion"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue="65"
                  onInput={(e) => {
                    const form = e.target.closest('form');
                    const val = form.querySelector('#desviacion').value; 
                    const out = form && form.querySelector('.desviacion-output');
                    if (out) out.textContent = `${val}%`;
                  }}
                  style={{ width: '45%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc', marginRight: '10px' }}
                /> 
                <button
                  type="button"
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setIsLoading(true);
                    try {
                      const form = document.querySelector('form');
                      const raw = form?.querySelector('#desviacion')?.value;
                      if (!raw) return;
                      const percent = Math.max(0, Math.min(100, Number(raw))) / 100;

                      setStatus(`Aplicando desviación ${Math.round(percent * 100)}%...`);

                      const fieldMapLocal = {
                        'poblacion': 'poblacion',
                        'numero_oficinas': 'num_oficinas',
                        'sueldo_medio': 'sueldo_medio',
                        'precio_alquiler': 'precio_alquiler',
                        'edad_media': 'edad_media',
                        'incremento_poblacion': 'increment_poblacio'
                      };
                      const field = fieldMapLocal[tipoMapa];
                      const valuesArray = mapInfo
                        .map(m => m[field])
                        .filter(v => v !== undefined && v !== null && !isNaN(v));

                      if (valuesArray.length === 0) {
                        setStatus('No hay datos disponibles para aplicar la desviación.');
                        return;
                      }
 
                      const sorted = [...valuesArray].sort((a, b) => a - b);
                      const cutoffIndex = Math.floor(sorted.length * percent);
                      const max = sorted[Math.min(cutoffIndex, sorted.length - 1)];
                      const min = sorted[0];
                      const palette = colores[tipoMapa] || colores.poblacion;

                      const normalize = s => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

                      const computeColor = (municipioName) => {
                        if (!Array.isArray(mapInfo)) return '#e0e0e0';
                        const nameNorm = normalize(municipioName);
                        const municipioData = mapInfo.find(m => m.nombre && normalize(m.nombre) === nameNorm);
                        if (!municipioData) return '#e0e0e0';
                        const value = municipioData[field];
                        if (value === undefined || value === null || isNaN(value)) return '#e0e0e0';
                        if (min === max) return palette[Math.floor(palette.length / 2)];
                        if (value > max) return palette[palette.length - 1];
                        const scale = d3.scaleQuantize().domain([min, max]).range(palette);
                        return scale(value);
                      };
 
                      d3.selectAll('.main-group > path, .main-group .canarias-group path')
                        .attr('fill', function(d) {
                          const munName = d.properties?.name || d.properties?.NAME_2;
                          return computeColor(munName);
                        });
 
                      const legendTexts = d3.selectAll('.legend text');
                      if (!legendTexts.empty()) { 
                        const rightText = legendTexts.nodes()[legendTexts.size() - 1];
                        if (rightText) {
                          const cutoffValue = sorted[Math.min(Math.floor(sorted.length * percent), sorted.length - 1)];
                          d3.select(rightText).text('>' + (cutoffValue ? cutoffValue.toLocaleString('es-ES') : '—'));
                        }
                      }

                      setTimeout(() => {
                        setStatus(`Desviación aplicada: ${Math.round(percent * 100)}%`);
                        setIsLoading(false);
                      }, 300);
                    } catch (err) {
                      console.error(err);
                      setStatus('Error aplicando desviación');
                      setIsLoading(false);
                    }
                    
                  }}
                >
                  Aplicar desviación
                </button>
            </div>

          </form>
        </div>
      </div>

      {/* Modal con los 3 mejores municipios */}
      {showTopModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          padding: '20px'
        }}
        onClick={() => setShowTopModal(false)}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '15px',
            padding: '30px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '25px',
              borderBottom: '2px solid #f0f0f0',
              paddingBottom: '15px'
            }}>
              <h2 style={{
                margin: 0,
                color: '#333',
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                🏆 Top 3 Mejores Municipios
              </h2>
              <button
                onClick={() => setShowTopModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '28px',
                  cursor: 'pointer',
                  color: '#999',
                  lineHeight: 1,
                  padding: '0 5px'
                }}
              >
                ×
              </button>
            </div>

            {top3Municipios.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                No se encontraron resultados
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {top3Municipios.map((item, index) => {
                  const municipio = item.municipio || item;
                  const puntuacion = item.puntuacion || 0;
                  const razon = item.razon || 'Municipio seleccionado por criterios combinados';
                   
                  const medallas = ['Top 1', 'Top 2', 'Top 3'];
                  const coloresFondo = ['#ffd700', '#c0c0c0', '#cd7f32'];
                  
                  return (
                    <div key={index} style={{
                      border: `3px solid ${coloresFondo[index]}`,
                      borderRadius: '12px',
                      padding: '20px',
                      backgroundColor: '#fafafa',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                        <span style={{ fontSize: '40px' }}>{medallas[index]}</span>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '20px' }}>
                            {municipio.nombre || 'Nombre no disponible'}
                          </h3>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                          }}>
                            <span style={{
                              backgroundColor: coloresFondo[index],
                              color: 'white',
                              padding: '4px 12px',
                              borderRadius: '20px',
                              fontWeight: 'bold',
                              fontSize: '16px'
                            }}>
                              {puntuacion.toFixed(1)} / 100
                            </span>
                          </div>
                        </div>
                      </div>

                      <p style={{
                        margin: '0 0 15px 0',
                        color: '#666',
                        fontStyle: 'italic',
                        fontSize: '14px',
                        lineHeight: '1.5'
                      }}>
                        "{razon}"
                      </p>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '10px',
                        backgroundColor: 'white',
                        padding: '15px',
                        borderRadius: '8px'
                      }}>
                        <div>
                          <strong style={{ color: '#666', fontSize: '12px' }}>Población:</strong>
                          <p style={{ margin: '5px 0 0 0', color: '#333', fontSize: '14px' }}>
                            {municipio.poblacion ? municipio.poblacion.toLocaleString('es-ES') : 'N/D'}
                          </p>
                        </div>
                        <div>
                          <strong style={{ color: '#666', fontSize: '12px' }}>Oficinas:</strong>
                          <p style={{ margin: '5px 0 0 0', color: '#333', fontSize: '14px' }}>
                            {municipio.num_oficinas || 'N/D'}
                          </p>
                        </div>
                        <div>
                          <strong style={{ color: '#666', fontSize: '12px' }}>Edad Media:</strong>
                          <p style={{ margin: '5px 0 0 0', color: '#333', fontSize: '14px' }}>
                            {municipio.edad_media ? `${municipio.edad_media.toFixed(1)} años` : 'N/D'}
                          </p>
                        </div>
                        <div>
                          <strong style={{ color: '#666', fontSize: '12px' }}>Sueldo Medio:</strong>
                          <p style={{ margin: '5px 0 0 0', color: '#333', fontSize: '14px' }}>
                            {municipio.sueldo_medio ? `${municipio.sueldo_medio.toLocaleString('es-ES')} €` : 'N/D'}
                          </p>
                        </div>
                        <div>
                          <strong style={{ color: '#666', fontSize: '12px' }}>Precio Alquiler:</strong>
                          <p style={{ margin: '5px 0 0 0', color: '#333', fontSize: '14px' }}>
                            {municipio.precio_alquiler ? `${municipio.precio_alquiler.toLocaleString('es-ES')} €` : 'N/D'}
                          </p>
                        </div>
                        <div>
                          <strong style={{ color: '#666', fontSize: '12px' }}>Incremento Población:</strong>
                          <p style={{ margin: '5px 0 0 0', color: '#333', fontSize: '14px' }}>
                            {municipio.increment_poblacio ? `${municipio.increment_poblacio.toFixed(2)}%` : 'N/D'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowTopModal(false)}
              style={{
                marginTop: '25px',
                width: '100%',
                padding: '12px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#45a049'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#4CAF50'}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
