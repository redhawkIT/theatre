import type {VFC} from 'react'
import React from 'react'
import type {ViewportShading} from '../../store'
import {FaCube, GiCube, GiIceCube, BiCube} from 'react-icons/all'
import {ToolbarSwitchSelect} from '@theatre/studio'

export interface ViewportShadingSelectProps {
  value: ViewportShading
  onChange: (value: ViewportShading) => void
}

const ViewportShadingSelect: VFC<ViewportShadingSelectProps> = ({
  value,
  onChange,
}) => (
  <ToolbarSwitchSelect
    value={value}
    onChange={onChange}
    options={[
      {
        value: 'wireframe',
        label: 'Display: Wireframe',
        icon: <BiCube />,
      },
      {
        value: 'flat',
        label: 'Display: Flat',
        icon: <GiCube />,
      },
      {
        value: 'solid',
        label: 'Display: Solid',
        icon: <FaCube />,
      },
      {
        value: 'rendered',
        label: 'Display: Rendered',
        icon: <GiIceCube />,
      },
    ]}
  />
)

export default ViewportShadingSelect
