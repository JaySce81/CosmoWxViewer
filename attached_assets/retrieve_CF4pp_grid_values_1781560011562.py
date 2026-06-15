#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Fri April 18 16:01:15 2025

@author: Amber M. Hollinger

Code to extract data, given an ra/l,dec/b,z/v_CMB, from the mean and standard deviations of the density and velocity grids calculated using the HMC realizations of the ungrouped CF4++ catalogue.
If used please reference: aa53677-25: "In search for the Local Universe dynamical homogeneity scale with CF4++ peculiar velocities"

"""


import astropy.units as u
from astropy.coordinates import SkyCoord
import numpy as np
import sys
coord1,coord2,distance = None,None,None

clight = 299792.458
    

def to_grid_index(coord, delta, N=128,L=1000):
   # Normalize the coordinate to be within the range [0, L)
   coord = (coord + L / 2) 
   # Convert to grid index
   index = np.floor(coord / delta).astype(int)
   # Ensure the index is within the valid range
   index = np.clip(index, 0, N-1)
   return index

def get_input_with_attempts(prompt = 'Please enter a valid coordinate system', options = ['redshift','velocity' ], max_attempts=3):
    attempts = 0
    while attempts < max_attempts:
        user_input = input(f'Please specify if using {options[0]} or {options[1]} :' )
        # Attempt to convert input to the desired data type
        try:
            if user_input in options:
                return user_input
            else: 
                attempts += 1
                if attempts<max_attempts:
                    print(f"Invalid input. {prompt}. ")
        except ValueError:
            attempts += 1
            print(f"Invalid input. {prompt}.")
    print("Maximum attempts reached. Exiting.")
    return 'Failed'

def get_coord_type(coord1,coord2,distance):
    coord_type =  get_input_with_attempts(prompt = 'Please enter a valid coordinate system', options = ['galactic','equitorial' ])
    if coord_type != 'Failed':
        unit_type =  get_input_with_attempts(prompt = 'Please enter a valid unit system', options = ['degrees','radians' ])
        if unit_type != 'Failed':
            if unit_type == 'degrees':
                units = u.deg
            else:
                units = u.rad
            velocity_type =  get_input_with_attempts(prompt = 'Please enter a valid distance type', options = ['redshift','velocity' ])
            if velocity_type != 'Failed':
                if velocity_type == 'redshift':
                    distance *= clight/100
                elif velocity_type == 'velocity':
                    distance /= 100
                if coord_type == 'galactic':
                    # Calculate the Supergalactic coordinates, sgl,sgb 

                    GC = SkyCoord(l=coord1, b=coord2, distance=distance, frame='galactic', unit=(units,units))
                    sgl = GC.supergalactic.sgl
                    sgb = GC.supergalactic.sgb
                else:
                    GC = SkyCoord(ra=coord1,dec=coord2, distance=distance, frame='fk5',equinox='J2000.000', unit=(units,units))
                    sgl = GC.supergalactic.sgl
                    sgb = GC.supergalactic.sgb
                    
                # Calculate the Supergalactic coordinates, SGX,SGy,SGZ
                SGC =SkyCoord(sgl=sgl, sgb=sgb, distance=distance, frame='supergalactic', unit=(u.deg, u.deg))
                sgx = SGC.cartesian.x.value  # .value extracts the numerical value from the Quantity
                sgy = SGC.cartesian.y.value
                sgz = SGC.cartesian.z.value
                
                ix = to_grid_index(sgx, delta=1000/128, N=128)
                iy = to_grid_index(sgy,  delta=1000/128, N=128)
                iz = to_grid_index(sgz,  delta=1000/128, N=128)

                # Returns at the given position, the mean density contrast, Cartesian and radial velocitities and their std of the HMC realizations
                d_data = np.load('CF4pp_mean_std_grids.npz')['d_mean_CF4pp']
                derr_data = np.load('CF4pp_mean_std_grids.npz')['d_std_CF4pp']
                vxyz_data = np.load('CF4pp_mean_std_grids.npz')['v_mean_CF4pp']
                vxyz_err_data = np.load('CF4pp_mean_std_grids.npz')['v_std_CF4pp']
                vr_data = np.load('CF4pp_mean_std_grids.npz')['vr_mean_CF4pp']
                verr_data = np.load('CF4pp_mean_std_grids.npz')['vr_std_CF4pp']

                return d_data[ix,iy,iz],derr_data[ix,iy,iz],vxyz_data[:,ix,iy,iz],vxyz_err_data[:,ix,iy,iz], vr_data[ix,iy,iz],verr_data[ix,iy,iz]

if len(sys.argv)==4:
    coord1,coord2,distance = np.float32(sys.argv[1]),np.float32(sys.argv[2]),np.float32(sys.argv[3])
else:
    while type(coord1)!= np.float32 or type(coord2)!= np.float32 or type(distance)!= np.float32:
        try: 
            coord1,coord2, distance = input('Please enter in values of type: ra,dec,distance or l,b,distance : ').split(',')
            coord1,coord2,distance = np.float32(coord1),np.float32(coord2), np.float32(distance)
        except :
            print('Expected 3 number values to be inputed separated by commmas.')

try:
    d,d_err,vxyz,vxyz_err,vr,vr_err  = get_coord_type(coord1, coord2, distance)
    print(f'mean delta and  : {d},{d_err}')
    print(f'mean radial velocity and uncertainty : {vr},{vr_err}')
    print(f'mean C