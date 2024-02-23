import { titleCase as _titleCase } from 'scule'

export function titleCase(key: string) {
  let label = _titleCase(key)
  if (label === 'Api') {
    label = 'API'
  }
  return label
}
